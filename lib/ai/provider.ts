/**
 * AI provider abstraction.
 * Default priority: Replicate → fal.ai → Gemini → HuggingFace → mock
 */

export type GenerationProvider = "gemini" | "fal" | "replicate" | "huggingface"

export interface ImageData {
  base64: string
  mimeType: string
}

export interface GenerateImageParams {
  prompt: string
  negativePrompt?: string
  // Placement data — used to build the inpainting mask for fal.ai FLUX fill
  placement?: {
    centerX: number
    centerY: number
    width: number
    height: number
    rotation: number
    facadeConfidence: number
  }
  // Gemini path — raw inline image data (preferred, supports multi-image).
  storefrontImageData?: ImageData    // image 1 — the storefront scene
  brandAssetImageData?: ImageData    // image 2 — the brand logo / asset
  referenceStyleImages?: ImageData[] // images 3–N — example sign style photos
  // fal.ai / HuggingFace path — raw file for upload
  storefrontFile?: File
  // Legacy URL fields
  referenceImageUrl?: string
  brandAssetImageUrl?: string
  width?: number
  height?: number
}

export interface GenerateImageResult {
  imageUrl: string
  provider: GenerationProvider
}

export function getActiveProvider(): GenerationProvider {
  if (process.env.REPLICATE_API_TOKEN) return "replicate"
  if (process.env.FAL_KEY) return "fal"
  if (process.env.GEMINI_API_KEY) return "gemini"
  if (process.env.HUGGINGFACE_API_KEY) return "huggingface"
  return "huggingface" // falls through to mock
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const provider = getActiveProvider()

  if (provider === "replicate") return generateWithReplicate(params)
  if (provider === "gemini") return generateWithGemini(params)
  if (provider === "fal") return generateWithFal(params)
  return generateWithHuggingFace(params)
}

// ─── Hardcoded system instruction sent with every Gemini generation ───────────
const SIGN_SYSTEM_INSTRUCTION = `
You are a professional signage expert, exterior designer, and CGI compositor.

Your task: look at the provided storefront photo and REPLACE the sign or storefront element inside the specified bounding box with a new professionally manufactured business sign.

STRICT RULES:

1. REPLACE, DON'T ADD. Whatever is currently in the bounding box — existing sign, old logo, text, panel, or any element — must be completely removed and replaced with the new brand sign. This is a replacement operation, not an overlay.

2. LOGO GOES IN THE BOUNDING BOX. If a brand logo image is provided (Image 2), that logo must appear as the visible face of the sign inside the bounding box. Scale it to fill the sign area proportionally. Reproduce every detail exactly — correct colors, correct shapes, correct proportions. The logo is manufactured into the sign material (etched, illuminated, cut). If only brand text is provided, render it in clean premium commercial typography inside the bounding box.

3. COLORS COME FROM THE BRAND. The sign's colors must come directly from the brand logo provided. Do not use generic silver, white, black, or default material colors. Match the logo's exact color palette — if the logo is red and white, the sign is red and white. If no logo — match the color palette shown in the reference sign photos.

4. MATCH THE REFERENCE STYLE EXACTLY. The reference sign photos show the precise style to reproduce — same material texture, same mounting type, same dimensional depth, same illumination character, same premium quality level.

5. BOUNDING BOX IS ABSOLUTE — PIXEL-PERFECT PRESERVATION. Every single pixel OUTSIDE the bounding box must be byte-for-byte identical to the original storefront photo. This means: same exact colors, same white balance, same exposure, same contrast, same saturation, same color temperature, same shadows, same highlights — zero color grading, zero tone mapping, zero enhancement of any kind applied to the original photo. If the original photo is slightly warm, keep it warm. If it is slightly dark, keep it dark. You are a compositor, not a photo editor. ONLY the sign area inside the bounding box may look different.

6. PHYSICAL REALISM. The new sign must look physically bolted to the facade — correct perspective, correct foreshortening, realistic mounting hardware (studs, screws, or raceway box), and realistic light interaction with the surrounding wall.

7. OUTPUT. One single photorealistic wide exterior photograph of the completed storefront with the new sign installed. Professional architectural photography quality. 16:9 aspect ratio.
`.trim()

// ─── Gemini (Nano Banana) via generateContent ─────────────────────────────────
// Model: gemini-2.0-flash-preview-image-generation
// Method: ai.models.generateContent with responseModalities: ["IMAGE"]
//
// Image slot layout (as parts):
//   [0] text prompt
//   [1] storefront photo       ← the scene to edit
//   [2] brand logo / asset     ← incorporate on the sign face (optional)
//   [3…N] reference style images ← sign style reference photos

async function generateWithGemini(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { GoogleGenAI } = await import("@google/genai")

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  type Part =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }

  const parts: Part[] = [{ text: params.prompt }]

  // Image 1 — storefront (the scene to edit)
  if (params.storefrontImageData) {
    parts.push({
      inlineData: {
        mimeType: params.storefrontImageData.mimeType,
        data: params.storefrontImageData.base64,
      },
    })
  }

  // Image 2 — brand logo / asset (optional)
  if (params.brandAssetImageData) {
    parts.push({
      inlineData: {
        mimeType: params.brandAssetImageData.mimeType,
        data: params.brandAssetImageData.base64,
      },
    })
  }

  // Images 3–N — reference sign style photos
  if (params.referenceStyleImages?.length) {
    for (const ref of params.referenceStyleImages.slice(0, 7)) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.base64,
        },
      })
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      systemInstruction: SIGN_SYSTEM_INSTRUCTION,
    },
  })

  // Find the image part in the response
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = part as any
    if (p.inlineData?.data) {
      return {
        imageUrl: `data:${p.inlineData.mimeType ?? "image/png"};base64,${p.inlineData.data}`,
        provider: "gemini",
      }
    }
  }

  throw new Error("Gemini returned no image — check model availability and API key quota")
}

// ─── fal.ai — FLUX.1-fill (inpainting) ───────────────────────────────────────
// Uses the storefront photo + a placement mask to edit ONLY the sign area.
// White pixels in the mask = area to fill. Black pixels = keep unchanged.
// Both image and mask are passed as base64 data URIs to guarantee dimension match.

async function generateWithFal(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { fal } = await import("@fal-ai/client")
  fal.config({ credentials: process.env.FAL_KEY! })

  // ── FLUX fill (inpainting) when storefront + placement are available ───────
  if (params.storefrontFile && params.placement) {
    const placement = params.placement

    // 1. Read the storefront into a buffer and detect its actual pixel dimensions
    const imageBuffer = Buffer.from(await params.storefrontFile.arrayBuffer())
    const { width: imgW, height: imgH } = getImageDimensions(imageBuffer)

    // 2. Build the mask at the EXACT same dimensions as the storefront photo
    const maskBuffer = buildMaskPng(imgW, imgH, placement)
    const maskFile = new File([new Uint8Array(maskBuffer)], "mask.png", { type: "image/png" })

    // 3. Upload both to fal storage in parallel — guarantees URL-based access
    //    without request body size limits
    const [imageUrl, maskUrl] = await Promise.all([
      fal.storage.upload(params.storefrontFile),
      fal.storage.upload(maskFile),
    ])

    // 4. Call SDXL Inpaint (free tier on fal.ai)
    const result = await fal.subscribe("fal-ai/inpaint", {
      input: {
        model_name:           "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
        image_url:            imageUrl,
        mask_url:             maskUrl,
        prompt:               params.prompt,
        negative_prompt:      params.negativePrompt ?? "",
        num_inference_steps:  30,
        guidance_scale:       7.5,
      },
    })

    const url = extractFalImageUrl(result)
    if (!url) throw new Error("fal.ai FLUX fill returned no image")
    return { imageUrl: url, provider: "fal" }
  }

  // ── Fallback: text-to-image with FLUX schnell ─────────────────────────────
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt:               params.prompt,
      image_size:           { width: params.width ?? 1024, height: params.height ?? 576 },
      num_inference_steps:  4,
      num_images:           1,
    },
  })

  const url = extractFalImageUrl(result)
  if (!url) throw new Error("fal.ai returned no image")
  return { imageUrl: url, provider: "fal" }
}

// ─── Image dimension reader (JPEG + PNG, no extra deps) ───────────────────────

function getImageDimensions(buf: Buffer): { width: number; height: number } {
  // PNG: signature is 8 bytes, then IHDR chunk (4 len + 4 type + 13 data)
  // Width at offset 16, height at offset 20 (big-endian uint32)
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return {
      width:  buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    }
  }

  // JPEG: scan for SOF marker (0xFF 0xC0 or 0xFF 0xC2)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 8) {
      if (buf[i] === 0xff) {
        const marker = buf[i + 1]
        // SOF0 = 0xC0, SOF1 = 0xC1, SOF2 = 0xC2 (progressive)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          return {
            height: buf.readUInt16BE(i + 5),
            width:  buf.readUInt16BE(i + 7),
          }
        }
        const segLen = buf.readUInt16BE(i + 2)
        i += 2 + segLen
      } else {
        i++
      }
    }
  }

  // Fallback — assume standard output size
  return { width: 1024, height: 576 }
}

// ─── Mask PNG builder ─────────────────────────────────────────────────────────
// Generates a minimal valid grayscale PNG with a white rectangle at the
// placement bounding box and black everywhere else.

function buildMaskPng(
  W: number,
  H: number,
  placement: NonNullable<GenerateImageParams["placement"]>
): Buffer {
  const { deflateSync } = require("zlib") as typeof import("zlib")

  const signH = placement.height ?? 0.14
  const left   = Math.max(0, Math.floor((placement.centerX - placement.width / 2) * W))
  const right  = Math.min(W, Math.ceil( (placement.centerX + placement.width / 2) * W))
  const top    = Math.max(0, Math.floor((placement.centerY - signH / 2) * H))
  const bottom = Math.min(H, Math.ceil( (placement.centerY + signH / 2) * H))

  // Raw image data: each row has 1 filter byte (0=None) + W pixel bytes
  const raw = Buffer.alloc(H * (1 + W), 0)
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      raw[y * (1 + W) + 1 + x] = 255
    }
  }

  const compressed = deflateSync(raw)

  // ── PNG helpers ────────────────────────────────────────────────────────────
  const crcTable = (() => {
    const t: number[] = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()

  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff]
    return (c ^ 0xffffffff) >>> 0
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, "ascii")
    const body = Buffer.concat([typeBuf, data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(body), 0)
    return Buffer.concat([lenBuf, body, crcBuf])
  }

  // IHDR: width, height, bit depth 8, color type 0 (grayscale)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 0  // grayscale
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function extractFalImageUrl(result: unknown): string | undefined {
  type FalImage = { url?: string }
  type FalResult = {
    image?: FalImage        // fal-ai/inpaint returns { image: { url } }
    images?: FalImage[]
    data?: {
      image?: FalImage
      images?: FalImage[]
      url?: string
    }
  }

  const typed = result as FalResult
  return (
    typed?.image?.url ??
    typed?.images?.[0]?.url ??
    typed?.data?.image?.url ??
    typed?.data?.images?.[0]?.url ??
    typed?.data?.url
  )
}

// ─── Replicate — FLUX.1 Kontext Pro (instruction-based image editing) ─────────
// No mask needed — the model understands natural language placement instructions.
// Model: black-forest-labs/flux-kontext-pro ($0.04/image)

async function generateWithReplicate(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const Replicate = (await import("replicate")).default
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })

  // Build input — if we have a storefront image, use it as the source image
  // and let the prompt describe exactly where and how to place the sign.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {
    prompt: params.prompt,
    output_format: "jpg",
    safety_tolerance: 2,
  }

  if (params.storefrontImageData) {
    input.input_image = `data:${params.storefrontImageData.mimeType};base64,${params.storefrontImageData.base64}`
  }

  const output = await replicate.run("black-forest-labs/flux-kontext-pro", { input })

  // Replicate SDK v1.x returns FileOutput objects — extract the URL string.
  // FileOutput has a .url() method; fallback handles plain strings and arrays.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractUrl = (val: any): string | undefined => {
    if (!val) return undefined
    if (typeof val === "string") return val
    if (typeof val?.url === "function") return val.url() as string
    if (typeof val?.toString === "function") {
      const s = val.toString()
      if (s.startsWith("http")) return s
    }
    return undefined
  }

  const raw = Array.isArray(output) ? output[0] : output
  const url = extractUrl(raw)

  if (!url) {
    throw new Error("Replicate returned no image — check your API key and model access")
  }

  return { imageUrl: url, provider: "replicate" }
}

// ─── Hugging Face ─────────────────────────────────────────────────────────────

async function generateWithHuggingFace(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const token = process.env.HUGGINGFACE_API_KEY

  if (!token) {
    return mockGenerate(params)
  }

  const fullPrompt = params.brandAssetImageUrl
    ? `${params.prompt} The sign should incorporate the brand's logo identity (reference: ${params.brandAssetImageUrl}).`
    : params.prompt

  const response = await fetch(
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          negative_prompt: params.negativePrompt,
          width: params.width ?? 1024,
          height: params.height ?? 576,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace error: ${err}`)
  }

  const blob = await response.blob()
  const buffer = Buffer.from(await blob.arrayBuffer())
  const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`

  return { imageUrl: dataUrl, provider: "huggingface" }
}

// ─── Mock (no API keys) ───────────────────────────────────────────────────────

async function mockGenerate(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const seed = encodeURIComponent(params.prompt.slice(0, 20))
  return {
    imageUrl: `https://picsum.photos/seed/${seed}/1024/576`,
    provider: "huggingface",
  }
}
