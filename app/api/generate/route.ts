import { NextRequest, NextResponse } from "next/server"
import { planVariations } from "@/lib/ai/variation-planner"
import { generateImage } from "@/lib/ai/provider"
import type { GenerationResult, Candidate, ReferenceStyle, Placement, VariationCount } from "@/types"
import { randomUUID } from "crypto"

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

    if (![1, 3, 6].includes(variationCount)) {
      return NextResponse.json({ error: "variationCount must be 1, 3, or 6" }, { status: 400 })
    }
    if (!references.length) {
      return NextResponse.json({ error: "At least one reference is required" }, { status: 400 })
    }

    // ─── Resolve brand text ─────────────────────────────────────────────────
    const resolvedBrandText = brandText ?? "Business"

    // ─── Upload storefront image for image-conditioned generation ───────────
    const storefrontImageUrl = await uploadStorefrontImage(storefrontFile)

    // ─── Plan variations ────────────────────────────────────────────────────
    const specs = await planVariations(references, variationCount, resolvedBrandText)

    // ─── Generate images in parallel ────────────────────────────────────────
    const generationPromises = specs.map(async (spec, i) => {
      const result = await generateImage({
        prompt: [
          spec.prompt,
          "Preserve the original storefront architecture and camera perspective.",
          "A clearly visible business sign must be present in the final image.",
          "The sign text must be legible and professionally mounted.",
          `Place the sign around facade center (${Math.round(placement.centerX * 100)}% x, ${Math.round(placement.centerY * 100)}% y), width about ${Math.round(placement.width * 100)}% of facade, rotation ${placement.rotation} degrees.`,
          "Do not remove the sign. Do not return an unchanged storefront.",
        ].join(" "),
        negativePrompt:
          "blurry, low quality, text errors, spelling mistakes, distorted letters, unrealistic, cartoon",
        referenceImageUrl: storefrontImageUrl,
        width: 1024,
        height: 576,
      })

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


async function uploadStorefrontImage(file: File): Promise<string | undefined> {
  if (!process.env.FAL_KEY) return undefined

  const { fal } = await import("@fal-ai/client")
  fal.config({ credentials: process.env.FAL_KEY })
  return fal.storage.upload(file)
}
