import { NextRequest, NextResponse } from "next/server"
import { planVariations, type BrandMode } from "@/lib/ai/variation-planner"
import { generateImage, getActiveProvider } from "@/lib/ai/provider"
import type { ImageData, GenerateImageParams } from "@/lib/ai/provider"
import type { GenerationResult, Candidate, ReferenceStyle, Placement, VariationCount } from "@/types"
import { randomUUID } from "crypto"
import { readFile } from "fs/promises"
import { join } from "path"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    // ─── Parse and validate inputs ──────────────────────────────────────────
    const storefrontFile = formData.get("storefront") as File | null
    const brandAssetFile = formData.get("brandAsset") as File | null
    const brandText = formData.get("brandText") as string | null
    const referencesRaw = formData.get("references") as string | null
    const placementRaw = formData.get("placement") as string | null
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
    if (!placementRaw) {
      return NextResponse.json({ error: "Placement data is required" }, { status: 400 })
    }
    if (!variationCountRaw) {
      return NextResponse.json({ error: "Variation count is required" }, { status: 400 })
    }

    const references: ReferenceStyle[] = JSON.parse(referencesRaw)
    const placement: Placement = JSON.parse(placementRaw)
    const variationCount = parseInt(variationCountRaw, 10) as VariationCount
    const requestedProvider = formData.get("provider") as string | null

    if (![1, 3, 6].includes(variationCount)) {
      return NextResponse.json({ error: "variationCount must be 1, 3, or 6" }, { status: 400 })
    }
    if (!references.length) {
      return NextResponse.json({ error: "At least one reference is required" }, { status: 400 })
    }

    // ─── Resolve brand text and mode ────────────────────────────────────────
    const resolvedBrandText = brandText ?? "Business"
    const brandMode: BrandMode =
      brandAssetFile && brandText ? "logo-and-text"
      : brandAssetFile           ? "logo-only"
      :                            "text-only"

    // ─── Resolve provider: use client selection if valid, else auto-detect ──
    const provider = (
      requestedProvider === "fal" || requestedProvider === "gemini" ||
      requestedProvider === "replicate" || requestedProvider === "huggingface"
        ? requestedProvider
        : getActiveProvider()
    ) as "fal" | "gemini" | "replicate" | "huggingface"

    let storefrontImageData: ImageData | undefined
    let brandAssetImageData: ImageData | undefined
    let storefrontImageUrl: string | undefined
    let brandAssetImageUrl: string | undefined

    if (provider === "gemini" || provider === "replicate") {
      // Gemini + Replicate: pass images as raw inline base64 data
      storefrontImageData = await fileToImageData(storefrontFile)
      if (brandAssetFile) {
        brandAssetImageData = await fileToImageData(brandAssetFile)
      }
    } else if (provider === "huggingface") {
      // HuggingFace: upload to remote storage for URL-based access
      const [sfUrl, baUrl] = await Promise.all([
        uploadImageToStorage(storefrontFile),
        brandAssetFile ? uploadImageToStorage(brandAssetFile) : Promise.resolve(undefined),
      ])
      storefrontImageUrl = sfUrl
      brandAssetImageUrl = baUrl
    }
    // fal.ai: storefront file is passed directly (provider handles upload + mask internally)

    // ─── Load reference style images from disk (Gemini only) ───────────────
    // Drop any that don't exist yet — gracefully degrades to metadata-only prompting.
    let referenceStyleImages: ImageData[] | undefined
    if (provider === "gemini") {
      // Gemini supports multi-image input — pass reference photos inline
      referenceStyleImages = await loadReferenceStyleImages(references)
    }

    // ─── Plan variations ────────────────────────────────────────────────────
    const specs = await planVariations(references, variationCount, resolvedBrandText, brandMode)

    // ─── Generate images in parallel ────────────────────────────────────────
    // Compute exact bounding box from placement (all values in % of image dimensions)
    const signH = placement.height ?? 0.14
    const boxLeft   = Math.max(0, Math.round((placement.centerX - placement.width / 2) * 100))
    const boxRight  = Math.min(100, Math.round((placement.centerX + placement.width / 2) * 100))
    const boxTop    = Math.max(0, Math.round((placement.centerY - signH / 2) * 100))
    const boxBottom = Math.min(100, Math.round((placement.centerY + signH / 2) * 100))

    const placementInstruction = [
      `BOUNDING BOX CONSTRAINT (CRITICAL): The new sign must be installed ONLY within this rectangular region of the image:`,
      `  Left edge: ${boxLeft}% from left`,
      `  Right edge: ${boxRight}% from left`,
      `  Top edge: ${boxTop}% from top`,
      `  Bottom edge: ${boxBottom}% from top`,
      `  Rotation: ${placement.rotation ?? 0} degrees`,
      `ABSOLUTE RULE: Every pixel OUTSIDE this bounding box must be 100% identical to the original storefront photo — no changes, no enhancements, no color grading.`,
      `The sign must be sized and positioned to fill this exact box, anchored to the facade surface with correct perspective.`,
    ].join(" ")

    const generationPromises = specs.map(async (spec, i) => {
      // Build a slot-accurate description so the model knows exactly what each image is.
      // Slot numbers shift depending on whether the client uploaded a logo or not.
      let imageSlotDescription = ""
      if (provider === "gemini") {
        let slot = 1
        const slotLines: string[] = []

        slotLines.push(`Image ${slot++} = the client's storefront — this is the scene to edit, do not alter anything except the sign area.`)

        if (brandAssetImageData) {
          if (brandMode === "logo-only") {
            slotLines.push(
              `Image ${slot++} = the client's brand logo (LOGO ONLY mode). ` +
              `This logo is the ONLY sign content — place it inside the bounding box scaled to fill the sign face. ` +
              `Reproduce it exactly: same colors, same shapes, same proportions. No text, no name added.`
            )
          } else {
            // logo-and-text
            slotLines.push(
              `Image ${slot++} = the client's brand logo (LOGO + NAME mode). ` +
              `Place this logo as the dominant primary element inside the bounding box. ` +
              `The brand name "${resolvedBrandText}" appears as secondary text below or beside the logo. ` +
              `Reproduce the logo exactly: same colors, same shapes, same proportions.`
            )
          }
        }

        if (referenceStyleImages?.length) {
          const refStart = slot
          const refEnd = slot + referenceStyleImages.length - 1
          const range = refStart === refEnd ? `Image ${refStart}` : `Images ${refStart}–${refEnd}`
          slotLines.push(
            `${range} = the client's chosen sign style reference photo — this is your PRIMARY visual guide. ` +
            `Replicate EXACTLY: the lighting type (front-lit, halo backlit, neon, unlit), the light color and temperature, the illumination intensity, the glow spread on the wall, the material texture, the dimensional depth, the mounting style, and the overall premium quality shown in this photo. ` +
            `The generated sign must look like it belongs to the same product family as this reference.`
          )
        }

        imageSlotDescription = slotLines.join(" ")
      }

      const fullPrompt = [
        spec.prompt,
        placementInstruction,
        imageSlotDescription,
      ].filter(Boolean).join(" ")

      // Log the full prompt so you can inspect it in the server terminal
      console.log(`\n[generate] ── PROMPT (variation ${i + 1}) ────────────────────`)
      console.log(`Brand mode : ${brandMode}`)
      console.log(`Provider   : ${provider}`)
      console.log(`Images sent: storefront${brandAssetImageData ? " + logo" : ""}${referenceStyleImages?.length ? ` + ${referenceStyleImages.length} reference(s)` : ""}`)
      console.log(`\n${fullPrompt}\n`)
      console.log(`──────────────────────────────────────────────────────────────\n`)

      const params: GenerateImageParams = {
        prompt: fullPrompt,
        negativePrompt:
          "blurry, low quality, text errors, spelling mistakes, distorted letters, unrealistic, cartoon",
        // Placement — used by fal.ai to build the inpainting mask
        placement,
        // Gemini inputs
        storefrontImageData,
        brandAssetImageData,
        referenceStyleImages,
        // fal.ai FLUX fill — pass the raw file so the provider can upload + mask
        storefrontFile: provider === "fal" ? storefrontFile : undefined,
        // HuggingFace inputs
        referenceImageUrl: storefrontImageUrl,
        brandAssetImageUrl,
        width: 1024,
        height: 576,
      }

      const result = await generateImage(params)

      // ── Composite: paste sign area from AI output onto original photo ───────
      // This guarantees pixel-perfect color preservation outside the bounding box.
      // Only applies when we have the original image as base64 (Gemini path).
      let finalImageUrl = result.imageUrl
      if (provider === "gemini" && storefrontImageData) {
        try {
          finalImageUrl = await compositeSignOntoOriginal(
            storefrontImageData.base64,
            result.imageUrl,
            { boxLeft, boxRight, boxTop, boxBottom }
          )
        } catch (compErr) {
          // Compositing failed — fall back to AI output as-is
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

async function uploadImageToStorage(file: File): Promise<string | undefined> {
  if (!process.env.FAL_KEY) return undefined

  const { fal } = await import("@fal-ai/client")
  fal.config({ credentials: process.env.FAL_KEY })
  return fal.storage.upload(file)
}

// ─── Compositor ───────────────────────────────────────────────────────────────
// Extracts the sign area from the AI-generated image and pastes it onto the
// original storefront photo. This ensures the background is always pixel-perfect
// regardless of how much the AI changed it.

async function compositeSignOntoOriginal(
  originalBase64: string,
  generatedImageUrl: string,
  box: { boxLeft: number; boxRight: number; boxTop: number; boxBottom: number }
): Promise<string> {
  const sharp = (await import("sharp")).default

  // Decode originals
  const originalBuf = Buffer.from(originalBase64, "base64")

  let generatedBuf: Buffer
  if (generatedImageUrl.startsWith("data:")) {
    const b64 = generatedImageUrl.split(",")[1]
    generatedBuf = Buffer.from(b64, "base64")
  } else {
    const res = await fetch(generatedImageUrl)
    generatedBuf = Buffer.from(await res.arrayBuffer())
  }

  // Get original dimensions
  const { width: origW, height: origH } = await sharp(originalBuf).metadata()
  if (!origW || !origH) throw new Error("Could not read original image dimensions")

  // Resize generated image to match original dimensions exactly
  const generatedResized = await sharp(generatedBuf)
    .resize(origW, origH, { fit: "fill" })
    .toBuffer()

  // Calculate pixel coordinates from percentage bounding box
  const left   = Math.round((box.boxLeft   / 100) * origW)
  const top    = Math.round((box.boxTop    / 100) * origH)
  const right  = Math.round((box.boxRight  / 100) * origW)
  const bottom = Math.round((box.boxBottom / 100) * origH)
  const width  = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)

  // Extract only the sign region from the AI-generated image
  const signRegion = await sharp(generatedResized)
    .extract({ left, top, width, height })
    .toBuffer()

  // Composite the sign region onto the original photo at the exact same position
  const composited = await sharp(originalBuf)
    .composite([{ input: signRegion, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer()

  return `data:image/jpeg;base64,${composited.toString("base64")}`
}

// Load reference style example images from /public/references/*.
// Silently skips any file that doesn't exist yet — adding images later
// automatically improves generation quality without code changes.
async function loadReferenceStyleImages(references: ReferenceStyle[]): Promise<ImageData[]> {
  const results: ImageData[] = []

  for (const ref of references) {
    if (!ref.imageUrl) continue
    // imageUrl is like "/references/dimensional-brushed.jpg"
    const filePath = join(process.cwd(), "public", ref.imageUrl)
    try {
      const buffer = await readFile(filePath)
      const ext = ref.imageUrl.split(".").pop()?.toLowerCase() ?? "jpg"
      const mimeType = ext === "png" ? "image/png" : "image/jpeg"
      results.push({ base64: buffer.toString("base64"), mimeType })
    } catch {
      // File doesn't exist yet — skip gracefully
    }
  }

  return results
}
