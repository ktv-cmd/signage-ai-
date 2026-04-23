import { NextRequest, NextResponse } from "next/server"
import { planVariations, type BrandMode } from "@/lib/ai/variation-planner"
import { generateImage, getActiveProvider } from "@/lib/ai/provider"
import type { ImageData, GenerateImageParams, ApiGenerationProvider } from "@/lib/ai/provider"
import type { GenerationResult, Candidate, ReferenceStyle, Placement, VariationCount, TextStyling } from "@/types"
import { randomUUID } from "crypto"

function isGeminiProvider(p: string | null | undefined): p is "gemini" | "gemini-2.5" {
  return p === "gemini" || p === "gemini-2.5"
}

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // ─── Parse and validate inputs ──────────────────────────────────────────
    const storefrontFile = formData.get("storefront") as File | null
    const brandAssetFile = formData.get("brandAsset") as File | null
    const brandText = formData.get("brandText") as string | null
    const textStylingRaw = formData.get("textStyling") as string | null
    const referencesRaw = formData.get("references") as string | null
    const variationCountRaw = formData.get("variationCount") as string | null

    if (!storefrontFile) {
      return NextResponse.json({ error: "Storefront image is required" }, { status: 400 })
    }
    if (!brandText && !brandAssetFile) {
      return NextResponse.json({ error: "Brand asset or text is required" }, { status: 400 })
    }
    if (!referencesRaw) {
      return NextResponse.json({ error: "At least one reference style is required" }, { status: 400 })
    }
    if (!variationCountRaw) {
      return NextResponse.json({ error: "Variation count is required" }, { status: 400 })
    }

    const placementBrushFile = formData.get("placementBrush") as File | null
    if (!placementBrushFile || placementBrushFile.size === 0) {
      return NextResponse.json(
        { error: "Paint where the sign should go on the building, then continue." },
        { status: 400 }
      )
    }
    const placementBrushBuffer = Buffer.from(await placementBrushFile.arrayBuffer())

    const references: ReferenceStyle[] = JSON.parse(referencesRaw)
    const placementRaw = formData.get("placement") as string | null
    const placement: Placement = placementRaw
      ? JSON.parse(placementRaw)
      : {
          centerX: 0.5,
          centerY: 0.22,
          width: 0.68,
          height: 0.14,
          rotation: 0,
          facadeConfidence: 0.85,
        }
    const variationCount = parseInt(variationCountRaw, 10) as VariationCount
    const rawProvider = formData.get("provider") as string | null
    const requestedProvider =
      rawProvider === "fal-grok" || rawProvider === "fal-flux-kontext" ? "fal" : rawProvider

    if (![1, 3, 6].includes(variationCount)) {
      return NextResponse.json({ error: "variationCount must be 1, 3, or 6" }, { status: 400 })
    }
    if (!references.length) {
      return NextResponse.json({ error: "At least one reference is required" }, { status: 400 })
    }

    // ─── Resolve brand text and mode ────────────────────────────────────────
    const resolvedBrandText = brandText ?? "Business"
    const textStyling: TextStyling | undefined = textStylingRaw ? JSON.parse(textStylingRaw) : undefined
    const brandMode: BrandMode =
      brandAssetFile && brandText ? "logo-and-text"
      : brandAssetFile           ? "logo-only"
      :                            "text-only"

    // ─── Resolve provider: use client selection if valid, else auto-detect ──
    const provider = (
      requestedProvider === "fal" ||
      isGeminiProvider(requestedProvider) ||
      requestedProvider === "replicate" ||
      requestedProvider === "huggingface"
        ? requestedProvider
        : getActiveProvider()
    ) as ApiGenerationProvider

    const originalStorefrontImageData = await fileToImageData(storefrontFile)
    const storefrontBuffer = Buffer.from(originalStorefrontImageData.base64, "base64")

    const guidedStorefrontBuffer = await applyBrushGuideToStorefront(
      storefrontBuffer,
      placementBrushBuffer
    )
    const guidedStorefrontFile = new File(
      [new Uint8Array(guidedStorefrontBuffer)],
      "storefront-with-placement-guide.jpg",
      { type: "image/jpeg" }
    )

    let storefrontImageData: ImageData | undefined
    let brandAssetImageData: ImageData | undefined
    let storefrontImageUrl: string | undefined
    let brandAssetImageUrl: string | undefined

    if (brandAssetFile) {
      brandAssetImageData = await fileToImageData(brandAssetFile)
    }

    if (isGeminiProvider(provider) || provider === "replicate") {
      storefrontImageData = {
        base64: guidedStorefrontBuffer.toString("base64"),
        mimeType: "image/jpeg",
      }
    } else if (provider === "huggingface") {
      const [sfUrl, baUrl] = await Promise.all([
        uploadImageToStorage(guidedStorefrontFile),
        brandAssetFile ? uploadImageToStorage(brandAssetFile) : Promise.resolve(undefined),
      ])
      storefrontImageUrl = sfUrl
      brandAssetImageUrl = baUrl
    }
    // ─── Plan variations ────────────────────────────────────────────────────
    const specs = await planVariations(references, variationCount, resolvedBrandText, brandMode, textStyling)

    // ─── Generate images in parallel ────────────────────────────────────────
    const generationPromises = specs.map(async (spec, i) => {
      let imageSlotDescription = ""
      if (isGeminiProvider(provider) || provider === "fal") {
        let slot = 1
        const slotLines: string[] = []

        slotLines.push(
          `Image ${slot++}: storefront — gold/yellow shows zones where new signage goes; edit only those areas.`
        )

        if (brandAssetImageData) {
          if (brandMode === "logo-only") {
            slotLines.push(`Image ${slot++}: supplied logo file — use as the sign artwork (colors from this file).`)
          } else {
            slotLines.push(`Image ${slot++}: supplied logo file — pair with name "${resolvedBrandText}" per the text instructions.`)
          }
        }

        imageSlotDescription = slotLines.join(" ")
      }

      const fullPrompt = [spec.prompt, imageSlotDescription].filter(Boolean).join(" ")

      // Log the full prompt so you can inspect it in the server terminal
      console.log(`\n[generate] ── PROMPT (variation ${i + 1}) ────────────────────`)
      console.log(`Brand mode : ${brandMode}`)
      console.log(`Provider   : ${provider}`)
      if (isGeminiProvider(provider)) {
        console.log(
          `Images to Gemini: 1) storefront with gold highlight${brandAssetImageData ? "  2) logo" : " only"}`
        )
      } else if (provider === "fal") {
        console.log(
          `Same prompt text as Gemini. fal: marked storefront + fill region for inpaint.` +
            (brandAssetImageData ? " Logo in prompt only for SDXL." : "")
        )
      } else {
        console.log(`Prompt: spec.prompt only (no slot lines for this provider).`)
      }
      console.log(`\n${fullPrompt}\n`)
      console.log(`──────────────────────────────────────────────────────────────\n`)

      const params: GenerateImageParams = {
        prompt: fullPrompt,
        provider,
        negativePrompt:
          "blurry, low quality, text errors, spelling mistakes, distorted letters, unrealistic, cartoon",
        placement,
        placementBrushPng: placementBrushBuffer,
        storefrontImageData,
        brandAssetImageData,
        referenceStyleImages: undefined,
        storefrontFile: provider === "fal" ? guidedStorefrontFile : undefined,
        // HuggingFace inputs
        referenceImageUrl: storefrontImageUrl,
        brandAssetImageUrl,
        width: 1024,
        height: 576,
      }

      const result = await generateImage(params)

      let finalImageUrl = result.imageUrl
      if (isGeminiProvider(provider) && originalStorefrontImageData) {
        try {
          finalImageUrl = await compositeSignOntoOriginalWithBrush(
            originalStorefrontImageData.base64,
            result.imageUrl,
            placementBrushBuffer
          )
        } catch (compErr) {
          console.warn("[generate] Compositing failed, using raw AI output:", compErr)
        }
      }

      const candidate: Candidate = {
        id: randomUUID(),
        variantIndex: i,
        imageUrl: finalImageUrl,
        spec,
        generatedAt: new Date().toISOString(),
      }
      return candidate
    })

    const candidates = await Promise.all(generationPromises)

    // ─── Determine lighting compatibility from selected references ──────────
    const allAllowedModes = Array.from(
      new Set(references.flatMap((r) => r.compatibleLightModes))
    ) as ("front" | "back" | "both")[]

    const response: GenerationResult = {
      jobId: randomUUID(),
      candidates,
      compatibility: {
        allowedLightModes: allAllowedModes,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("[generate] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fileToImageData(file: File): Promise<ImageData> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return {
    base64: buffer.toString("base64"),
    mimeType: file.type || "image/jpeg",
  }
}

async function applyBrushGuideToStorefront(
  imageBuffer: Buffer,
  brushPngBuffer: Buffer
): Promise<Buffer> {
  const sharp = (await import("sharp")).default
  const meta = await sharp(imageBuffer).metadata()
  const W = meta.width ?? 1024
  const H = meta.height ?? 576

  const brushResized = await sharp(brushPngBuffer)
    .resize(W, H, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer()

  const overlay = Buffer.alloc(W * H * 4)
  const threshold = 40
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = brushResized[y * W + x]
      const i = (y * W + x) * 4
      if (v > threshold) {
        overlay[i] = 255
        overlay[i + 1] = 215
        overlay[i + 2] = 64
        overlay[i + 3] = 130
      }
    }
  }

  const overlayPng = await sharp(overlay, {
    raw: { width: W, height: H, channels: 4 },
  })
    .png()
    .toBuffer()

  return sharp(imageBuffer)
    .composite([{ input: overlayPng, blend: "over" }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function uploadImageToStorage(file: File): Promise<string | undefined> {
  if (!process.env.FAL_KEY) return undefined

  const { fal } = await import("@fal-ai/client")
  fal.config({ credentials: process.env.FAL_KEY })
  return fal.storage.upload(file)
}

async function compositeSignOntoOriginalWithBrush(
  originalBase64: string,
  generatedImageUrl: string,
  brushPngBuffer: Buffer
): Promise<string> {
  const sharp = (await import("sharp")).default
  const originalBuf = Buffer.from(originalBase64, "base64")

  let generatedBuf: Buffer
  if (generatedImageUrl.startsWith("data:")) {
    const b64 = generatedImageUrl.split(",")[1]
    if (!b64) throw new Error("Invalid data URL for generated image")
    generatedBuf = Buffer.from(b64, "base64")
  } else {
    const res = await fetch(generatedImageUrl)
    generatedBuf = Buffer.from(await res.arrayBuffer())
  }

  const { width: origW, height: origH } = await sharp(originalBuf).metadata()
  if (!origW || !origH) throw new Error("Could not read original image dimensions")

  const origRgb = await sharp(originalBuf)
    .resize(origW, origH)
    .removeAlpha()
    .raw()
    .toBuffer()

  const genRgb = await sharp(generatedBuf)
    .resize(origW, origH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer()

  const blendWeight = await sharp(brushPngBuffer)
    .resize(origW, origH, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer()

  const n = origW * origH
  const out = Buffer.alloc(n * 3)
  for (let i = 0; i < n; i++) {
    const m = blendWeight[i]! / 255
    const o = i * 3
    out[o] = Math.round(origRgb[o]! * (1 - m) + genRgb[o]! * m)
    out[o + 1] = Math.round(origRgb[o + 1]! * (1 - m) + genRgb[o + 1]! * m)
    out[o + 2] = Math.round(origRgb[o + 2]! * (1 - m) + genRgb[o + 2]! * m)
  }

  const jpeg = await sharp(out, {
    raw: { width: origW, height: origH, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer()

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`
}
