import { NextRequest, NextResponse } from "next/server"
import type { AdjustmentSettings } from "@/types"

export const maxDuration = 30

/**
 * Lightweight adjust endpoint.
 * For color/light/day-night changes: returns the same image URL + adjustment
 * metadata to apply client-side CSS filters. No regeneration.
 *
 * Only triggers full regeneration when structural changes require it
 * (e.g. switching lighting mode that is incompatible with current render).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      candidateImageUrl,
      adjustments,
      requiresRegeneration,
    }: {
      candidateImageUrl: string
      adjustments: AdjustmentSettings
      requiresRegeneration?: boolean
    } = body

    if (!candidateImageUrl) {
      return NextResponse.json({ error: "candidateImageUrl is required" }, { status: 400 })
    }
    if (!adjustments) {
      return NextResponse.json({ error: "adjustments are required" }, { status: 400 })
    }

    if (!requiresRegeneration) {
      // Fast path: return CSS filter instructions for client to apply
      const cssFilters = buildCssFilters(adjustments)
      return NextResponse.json({
        imageUrl: candidateImageUrl,
        cssFilters,
        regenerated: false,
      })
    }

    // Slow path: structural change requires re-render
    // (placeholder — will call generation provider when needed)
    return NextResponse.json({
      imageUrl: candidateImageUrl,
      cssFilters: buildCssFilters(adjustments),
      regenerated: false,
      note: "Full re-render not yet implemented — returning original with filters",
    })
  } catch (err) {
    console.error("[adjust] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Adjustment failed" },
      { status: 500 }
    )
  }
}

function buildCssFilters(adjustments: AdjustmentSettings): string {
  const brightness = adjustments.timeOfDay === "night" ? 0.5 : 1.0
  const contrast = adjustments.timeOfDay === "night" ? 1.1 : 1.0
  const intensity = adjustments.lightIntensity / 100

  return `brightness(${brightness}) contrast(${contrast}) saturate(${0.8 + intensity * 0.4})`
}
