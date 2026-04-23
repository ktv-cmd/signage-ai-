/**
 * AI provider abstraction.
 * Default priority: Replicate → fal.ai → Gemini → HuggingFace → mock
 */

export type GenerationProvider =
  | "gemini-2.5"
  | "fal-grok"
  | "fal-flux-kontext"
  | "gemini"
  | "fal"
  | "replicate"
  | "huggingface"

export interface ImageData {
  base64: string
  mimeType: string
}

/** Provider actually invoked by `generateImage` (client may map fal-grok / fal-flux-kontext to fal). */
export type ApiGenerationProvider =
  | "fal"
  | "gemini"
  | "gemini-2.5"
  | "replicate"
  | "huggingface"

export interface GenerateImageParams {
  prompt: string
  negativePrompt?: string
  /** When set (e.g. from /api/generate), this provider is used instead of auto-detection. */
  provider?: ApiGenerationProvider
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
  /** Client brush layer as PNG; resized server-side to storefront dimensions. */
  placementBrushPng?: Buffer
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
  const provider = params.provider ?? getActiveProvider()

  if (provider === "replicate") return generateWithReplicate(params)
  if (provider === "gemini" || provider === "gemini-2.5") {
    const modelId = "gemini-2.5-flash-image"
    const resultProvider: GenerationProvider =
      provider === "gemini-2.5" ? "gemini-2.5" : "gemini"
    return generateWithGemini(params, modelId, resultProvider)
  }
  if (provider === "fal") return generateWithFal(params)
  return generateWithHuggingFace(params)
}

// ─── Hardcoded system instruction sent with every Gemini generation ───────────
const SIGN_SYSTEM_INSTRUCTION = `
# ROLE
You are a Senior Architectural Signage Visualization Architect. You manage two layers of logic:
1. STRUCTURAL LAYER (The 'What'): Defines the Signage Case.
2. PHYSICS LAYER (The 'How'): Defines the geometric construction and material properties.

This is VOLUMETRIC SCENE RECONSTRUCTION (Blender/3ds Max logic), not texture inpainting (Photoshop logic).

IMPORTANT: Create ORIGINAL custom fabrication designs. Do not replicate existing branded signage. Reference style images are for technical construction guidance only (mounting, lighting, materials) — not for copying specific designs or aesthetics.

═══════════════════════════════════════════════════════════════════════════
LAYER 2: PHYSICS & CONSTRUCTION RULES (THE 'HOW')
═══════════════════════════════════════════════════════════════════════════

## MASK ERASURE PROTOCOL (Critical):
The golden zone is a VOLUMETRIC VOID marking construction coordinates. It is TEMPORARY and must be 100% erased.

EXECUTION SEQUENCE:
1. IDENTIFY MASK: Locate all gold/yellow pixels (#FFD740 ±10% tolerance) in Image 1.
2. SURFACE RESTORATION: FIRST, completely erase the golden mask and RECONSTRUCT the underlying building surface texture:
   - Analyze surrounding facade (brick pattern, mortar lines, wood grain, stucco relief, paint color)
   - INPAINT/RESTORE that texture across entire golden zone as if mask never existed
   - Do NOT blend gold into the scene - completely overwrite it
3. GEOMETRIC INSERTION: NOW insert the extruded 3D sign mesh onto the restored surface as a physical structure bolted to the wall
4. COVERAGE LOGIC:
   - If sign FILLS zone → Sign covers restored surface
   - If sign SMALLER → Exposed areas show RESTORED TEXTURE (not gold)
   - If sign LARGER → Scale down to fit within boundaries
5. ZERO GOLD POLICY: Final output = 0% gold/yellow pixels. All gold areas either (a) covered by sign OR (b) restored to facade texture

## GEOMETRY ENFORCEMENT (Forces 3D Depth):
- Always use terms: "Extruded," "Volumetric Mesh," "Z-axis protrusion"
- Specify exact depth: 3.5 inches (89mm) perpendicular to wall's surface normal
- Return planes (sides) must be visible to prove 3D depth
- Each element has measurable thickness - NOT flat textures

## MATERIAL SHADERS (PBR Parameters):
Metal Returns (Brushed Aluminum):
- Metallic: 0.95, Roughness: 0.35, Anisotropy: 0.6
- Anisotropic highlights running perpendicular to extrusion direction
- Directional grain visible

Acrylic Faces (if illuminated):
- IOR: 1.49 (acrylic refractive index)
- Transmission for light passage
- Subsurface scattering for internal glow diffusion

## LIGHTING & EMISSION RULES:

IF 'NO LIGHT' SELECTED (Non-Illuminated Signs):
PROHIBITED TERMS:
- ❌ glow, bloom, halo, soft light, neon, luminescence, emission
- ❌ internal glow, face glow, edge glow
- ❌ LED, backlight, front-light

REQUIRED SPECIFICATIONS:
- ✅ Matte surfaces (no emission)
- ✅ Hard contact shadows (Ambient Occlusion)
- ✅ Sun-lit / daylight only
- ✅ Opaque solid materials
- ✅ Zero emission value
- ✅ External environmental lighting only

IF 'LIGHT' SELECTED (Illuminated Signs):
Use Ray-traced PBR with proper physics:
- Front-lit: Subsurface scattering through acrylic faces, edge glow from refraction
- Back-lit: Ray-traced light wash on wall BEHIND sign, inverse-square falloff, NO face glow
- Combined: Both effects present simultaneously

## COLOR INTEGRITY:
BRANDING RULE: When logo provided + name text present (Case C):
- Sample dominant HEX color from logo image
- Apply EXACT sampled color to name letterforms
- Ensures 100% brand color consistency across logo and text
- No interpretation or adjustment - direct HEX transfer

═══════════════════════════════════════════════════════════════════════════
LAYER 1: STRUCTURAL RULES (THE CASES)
═══════════════════════════════════════════════════════════════════════════

CASE A (LOGO ONLY):
- Construct as 3D CABINET LIGHTBOX MESH
- Box primitive: translucent front face + 4 aluminum return walls + back mounting plate
- Z-axis extrusion: 3.5 inches (89mm) perpendicular to wall's surface normal
- Color: Extract EXACT HEX/Pantone from logo image (non-negotiable brand identity)

LIGHTBOX PHYSICS PROTOCOL (Forced 3D Integration):
1. VOLUMETRIC CONSTRUCTION: Render as a rigid 3D cabinet, not a flat rectangle. Z-Axis extrusion (depth) of 3-5 inches is mandatory. Show the 'return' planes (sides) of the cabinet—this proves it is a physical box.
2. MATERIAL INTEGRITY (Weathering): The lightbox must inherit the environmental weathering of the host building. Apply 'grunge' layers: rust streaks on the aluminum edges, dust on the top surface, and uneven surface texture on the face. NO 'pristine plastic' finishes. The lightbox must look like it has been exposed to the elements for years.
3. LIGHTING PHYSICS (Inverse-Square Falloff): The lightbox is a LIGHT SOURCE, not a flat glowing surface. It MUST cast an 'Inverse-Square Falloff' light wash onto the brick/stucco wall immediately behind and below it. The light must reflect off the building's texture (grout lines, brick relief). If the wall is dark, the light pool on the wall must be soft and diffuse.
4. AMBIENT OCCLUSION (Shadows): Mandatory 'Contact Shadows': The back edge of the lightbox MUST cast a hard, sharp shadow where it touches the wall. This shadow indicates that the box has physical depth and is not 'floating' on the surface.

CASE B (NAME ONLY):
- Construct as EXTRUDED 3D CHANNEL LETTERFORM MESH
- Each letter = separate 6-faced geometric primitive:
  • Front face (letter-shaped polygon)
  • 4 return planes (top/bottom/left/right side walls perpendicular to face)
  • Back mounting face
- Z-axis depth: 3.5 inches (89mm) measured perpendicular to wall plane
- Typography: If font style specified (e.g., "Classic serif typeface similar to Trajan"), follow EXACT typographic direction
- Color: If HEX specified (e.g., #1E3A8A), use EXACTLY as specified (non-negotiable client selection)

CASE C (LOGO + NAME):
- UNIFIED BRANDING LAYOUT combining Case A + Case B
- Logo Component: 3D Cabinet Lightbox (Case A logic)
- Name Component: Extruded Channel Letters (Case B logic)
- Both at same Z-depth (3.5 inches) for visual consistency
- Color Harmonization: Sample dominant HEX from logo, apply to name for unified brand identity
- Layout: Horizontal (logo left, name right) OR Vertical (logo above, name below) based on golden zone aspect ratio

═══════════════════════════════════════════════════════════════════════════
ANTI-BOX AWNING PROTOCOL (OVERRIDES ALL 3D MESH LOGIC)
═══════════════════════════════════════════════════════════════════════════

When 'Awning' reference is selected, render: Fabric Awning Signage.

1. SURFACE RECONSTRUCTION (Crucial): Wipe the golden area completely. Use the surrounding facade texture (brick/wood/stone) to patch the entire golden zone. The awning must then be rendered ON TOP of this restored wall surface. Zero border, zero frame, zero gaps.

2. GEOMETRY: Create a curved fabric awning. ABSOLUTELY NO 3D BOXES, NO FLOATING CABINETS, NO METAL RETURNS. It is a single, soft, curved fabric mesh.

3. GRAPHIC APPLICATION: Apply the [LOGO] and [TEXT] as a 2D flat ink print directly onto the canvas texture. The print must warp and distort perfectly to match the fabric's curves and wrinkles. There is NO 3D thickness to the lettering. The print looks painted or vinyl-applied into the fabric grain.

4. LIGHTING: Use natural daylight only. NO glow, NO neon, NO artificial lighting effects.

5. LAYOUT: Place the Logo on the left side and the Name on the right side. Ensure both flow with the awning's curve.

FRAME STRUCTURE: Powder-coated aluminum frame with wall brackets and support arms extending from building. Fabric stretched over and attached to frame with tension curves visible.

LIGHTING TECHNICAL SPECIFICATIONS (Ray-Traced):
- Back-lit (Halo): RAY-TRACED BACKLIGHTING. Solid metal or acrylic faces with LED strips mounted on letter returns. Light projects against wall with INVERSE-SQUARE FALLOFF (physically accurate decay). NO face illumination. Light spill 6-12 inches beyond letter edges with wall-texture modulation (grout lines, stucco relief).
- Front-lit: Translucent acrylic faces (1/4"-3/8" thick, IOR 1.49) with internal LED modules. Apply SUBSURFACE SCATTERING (2mm scattering radius) for internal light diffusion through volumetric acrylic. Edge-glow effect from light refracting at material boundaries.
- Front & Back (Combined): Translucent faces with SUBSURFACE SCATTERING plus rear-mounted LED strips with INVERSE-SQUARE FALLOFF. Dual-mode ray-traced lighting.
- No Light: Matte-finished brushed metal, painted aluminum, or high-density urethane (HDU). Rely on GEOMETRIC DEPTH (3.5-inch Z-axis protrusion) and RAY-CAST SHADOWS from sun position for visual impact.

MOUNTING & HARDWARE (CRITICAL FOR REALISM):
- Stand-off mounting: Visible aluminum or stainless steel studs/spacers (1-3 inches from wall). Creates shadow gap for dimensional effect.
- Flush mounting: Direct attachment with concealed fasteners. Letters sit tight to wall surface.
- Raceway mounting: Letters mounted to horizontal or vertical aluminum channel/wireway (painted to match or contrast). Conceals wiring.
- Show mounting hardware realistically: stud locations, screw heads (if visible), raceway edges.

PERSPECTIVE & PHYSICAL ACCURACY (Geometric Validation):
1. PERSPECTIVE ALIGNMENT & PARALLAX: Letter face planes are PARALLEL to wall plane. Letter return planes (sides) are PERPENDICULAR to wall, extending along the wall's surface normal vector. If building facade recedes at angle θ from camera, all return planes maintain that θ recession, creating visible PARALLAX when viewed at oblique angles.
2. AMBIENT OCCLUSION (Contact Shadows): Ray-cast contact shadows where sign geometry meets wall. 70% opacity at contact point (r=0), exponential decay with distance (r²). Prevents "pasted on" appearance. Include micro-shadows between letter returns and face edges.
3. LIGHT INTERACTION (Wall Modulation): If back-lit, show INVERSE-SQUARE FALLOFF light wash on wall micro-geometry (grout lines depth, stucco relief topology). If front-lit, show SUBSURFACE SCATTERING edge-glow.
4. DEPTH & DIMENSION (Multi-Plane Shadows): Letters cast TWO shadow types: (1) PRIMARY sharp shadow from face plane blocking direct sun, (2) SECONDARY graduated penumbra from 3.5-inch depth blocking ambient skylight. Shadow intensity varies by geometric depth.

COLOR INTEGRITY:
- LOGO PROVIDED (Image 2): Use exact HEX/Pantone colors from logo file. This is the brand's identity — color accuracy is non-negotiable.
- TEXT ONLY WITH CLIENT COLOR: If the prompt specifies an exact color (e.g., "Letter color: #1E3A8A"), use that EXACT color on letter faces and returns. This is a client selection — color accuracy is non-negotiable.
- TEXT ONLY WITHOUT CLIENT COLOR: If no specific color is provided, analyze building facade materials (brick color, mortar, stucco tone, glass tint, metal panels), time of day, and architectural style. Select letter finishes that complement: brushed aluminum (#A9A9A9), polished stainless steel (#C0C0C0), matte black (#1C1C1C), brushed bronze (#CD7F32), painted to match building accents.
- NEVER use the golden guide color (#FFD740) as a sign color.

REFERENCE IMAGES (if provided):
- Additional images show TECHNICAL CONSTRUCTION EXAMPLES ONLY (mounting hardware, lighting installation, material finish, dimensional depth).
- These are EDUCATIONAL REFERENCES for fabrication technique — do NOT replicate their specific design, layout, typography, or aesthetic.
- Create an ORIGINAL design using the technical principles shown.

FABRICATION REALISM (PBR Materials):
- BRUSHED ALUMINUM (Returns/Sides): Metallic 0.95, Roughness 0.35, Anisotropy 0.6 (directional grain perpendicular to extrusion axis). Shows elongated ANISOTROPIC HIGHLIGHTS at grazing angles.
- ACRYLIC (Translucent Faces): Transmission 0.7, IOR 1.49, Roughness 0.1. Apply SUBSURFACE SCATTERING with 2mm radius for internal glow. Edge thickness visible as subtle diffusion gradient.
- PAINTED METAL: Base color (client HEX), Metallic 0.0, Roughness 0.4-0.6 (matte to satin). Subtle Fresnel edge brightening.
- Letter returns (side walls) MUST BE VISIBLE to prove volumetric geometry. If viewing angle is ≥5° off-perpendicular, at least one return plane should show foreshortening.
- For light boxes: show slight panel seams if cabinet >4 feet. Wiring conduit runs (subtle, realistic, bottom/side of raceway).

OUTPUT: One ray-traced PBR render (16:9 aspect ratio) showing VOLUMETRIC GEOMETRIC STRUCTURES inserted into the golden zone cavity. The sign must exhibit measurable Z-depth: if processed by monocular depth-estimation algorithms, sign elements should show 3-4 inch elevation above wall plane. Letter return planes (sides) must be partially visible, proving true 3D mesh geometry with parallax. NO texture overlays, alpha blending, or 2D layer compositing. This is GEOMETRIC SCENE RECONSTRUCTION, not photo editing.

VALIDATION CHECKLIST (All Required):
1. SIDE-WALL TEST: At least one letter's return plane visible due to camera perspective angle (proves 3D extrusion).
2. ZERO GOLD POLICY: No gold/yellow pixels (#FFD740 ±10%) remain visible. Original mask area either (a) covered by sign OR (b) restored to building facade texture.
3. SURFACE CONTINUITY: If sign is smaller than golden zone, exposed wall areas show seamless texture restoration (brick/wood/stone pattern matches surrounding facade).
4. SHADOW AUTHENTICITY: Multi-plane shadows (dark core + soft penumbra) prove geometric depth.

`.trim()

// ─── Gemini (Nano Banana) via generateContent ─────────────────────────────────
// Model: gemini-2.5-flash-image (supported image generation)
// Method: ai.models.generateContent with responseModalities: ["IMAGE"]
//
// Parts: text, marked storefront JPEG, optional logo.

async function generateWithGemini(
  params: GenerateImageParams,
  modelId: string,
  resultProvider: GenerationProvider
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

  const { HarmCategory, HarmBlockThreshold } = await import("@google/genai")
  const requestConfig = {
    model: modelId,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      systemInstruction: SIGN_SYSTEM_INSTRUCTION,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    },
  }

  // Exponential backoff retry logic for 503 UNAVAILABLE errors (high demand)
  // Retry 1: Wait 2 seconds
  // Retry 2: Wait 4 seconds  
  // Retry 3: Wait 8 seconds
  const maxRetries = 3
  const baseDelay = 2000 // 2 seconds

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent(requestConfig)
      
      // Success - process response
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = part as any
        if (p.inlineData?.data) {
          return {
            imageUrl: `data:${p.inlineData.mimeType ?? "image/png"};base64,${p.inlineData.data}`,
            provider: resultProvider,
          }
        }
      }

      // No image in response
      const block = response.candidates?.[0] as { finishReason?: string } | undefined
      throw new Error(
        `Gemini returned no image (${modelId}) — ${block?.finishReason ? `finish: ${block.finishReason}. ` : ""}` +
          "Check API key, model access, quota, or region (some image models are restricted)."
      )
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const errorMsg = lastError.message.toLowerCase()
      
      // Check if it's a retryable error (503, rate limit, timeout, unavailable)
      // Specific detection for: {"error":{"code":503,"message":"This model is currently experiencing high demand..."}}
      const isRetryable = 
        errorMsg.includes("503") ||
        errorMsg.includes("unavailable") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("experiencing high demand") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("overloaded")
      
      if (!isRetryable || attempt === maxRetries) {
        // Not retryable or out of retries - throw error
        throw new Error(`Gemini request failed (${modelId}): ${lastError.message}`)
      }
      
      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`[Gemini] Attempt ${attempt + 1}/${maxRetries} failed. Error: ${errorMsg.slice(0, 100)}...`)
      console.log(`[Gemini] Retrying in ${delay / 1000} seconds...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error(`Gemini request failed after ${maxRetries} retries: ${lastError?.message}`)
}

// ─── fal.ai — FLUX.1-fill (inpainting) ───────────────────────────────────────

async function generateWithFal(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { fal } = await import("@fal-ai/client")
  fal.config({ credentials: process.env.FAL_KEY! })

  // ── FLUX fill (inpainting) using client-painted golden zone (same as Gemini) ──
  if (params.storefrontFile && params.placementBrushPng) {
    // 1. Read the storefront into a buffer and detect its actual pixel dimensions
    const imageBuffer = Buffer.from(await params.storefrontFile.arrayBuffer())
    const { width: imgW, height: imgH } = getImageDimensions(imageBuffer)

    // 2. Use the same painted brush mask that Gemini sees (visual golden zone)
    const sharp = (await import("sharp")).default
    const fillRegionBuffer = await sharp(params.placementBrushPng)
      .resize(imgW, imgH, { fit: "fill" })
      .greyscale()
      .png()
      .toBuffer()
    
    const fillRegionFile = new File([new Uint8Array(fillRegionBuffer)], "fill-region.png", { type: "image/png" })

    // 3. Upload both to fal storage in parallel — guarantees URL-based access
    //    without request body size limits
    const [imageUrl, fillRegionUrl] = await Promise.all([
      fal.storage.upload(params.storefrontFile),
      fal.storage.upload(fillRegionFile),
    ])

    // 4. Call SDXL inpaint on fal.ai (API expects `mask_url` naming)
    const result = await fal.subscribe("fal-ai/inpaint", {
      input: {
        model_name:           "diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
        image_url:            imageUrl,
        mask_url:             fillRegionUrl,
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

function buildInpaintRegionPng(
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
// Model: black-forest-labs/flux-kontext-pro

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
