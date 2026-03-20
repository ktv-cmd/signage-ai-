import { NextRequest, NextResponse } from "next/server"
import { planVariations } from "@/lib/ai/variation-planner"
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

    // ─── Resolve brand text ─────────────────────────────────────────────────
    const resolvedBrandText = brandText ?? "Business"

    // ─── Resolve provider: use client selection if valid, else auto-detect ──
    const provider = (
      requestedProvider === "fal" || requestedProvider === "gemini" || requestedProvider === "huggingface"
        ? requestedProvider
        : getActiveProvider()
    ) as "fal" | "gemini" | "huggingface"

    let storefrontImageData: ImageData | undefined
    let brandAssetImageData: ImageData | undefined
    let storefrontImageUrl: string | undefined
    let brandAssetImageUrl: string | undefined

    if (provider === "gemini") {
      // Gemini: pass images as raw inline base64 data
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
      referenceStyleImages = await loadReferenceStyleImages(references)
    }

    // ─── Plan variations ────────────────────────────────────────────────────
    const specs = await planVariations(references, variationCount, resolvedBrandText)

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
          slotLines.push(`Image ${slot++} = the client's brand logo — reproduce it faithfully on the sign face.`)
        }

        if (referenceStyleImages?.length) {
          const refStart = slot
          const refEnd = slot + referenceStyleImages.length - 1
          const range = refStart === refEnd ? `Image ${refStart}` : `Images ${refStart}–${refEnd}`
          slotLines.push(`${range} = reference photo(s) of the chosen sign style — match this exact aesthetic, material, and mounting.`)
        }

        imageSlotDescription = slotLines.join(" ")
      }

      const params: GenerateImageParams = {
        prompt: [
          spec.prompt,
          placementInstruction,
          imageSlotDescription,
        ].filter(Boolean).join(" "),
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

      const candidate: Candidate = {
        id: randomUUID(),
        variantIndex: i,
        imageUrl: result.imageUrl,
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
