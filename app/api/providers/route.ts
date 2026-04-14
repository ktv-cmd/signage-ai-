import { NextResponse } from "next/server"
import type { GenerationProvider } from "@/lib/ai/provider"

/** Listed model id (may be a fal.ai variant; /api/generate normalizes to GenerationProvider). */
export type ListedModelId = GenerationProvider | "fal-grok" | "fal-flux-kontext"

export interface ModelInfo {
  id: ListedModelId
  name: string
  description: string
  available: boolean
  badge?: string
}

export interface ProviderGroup {
  groupId: string
  groupName: string
  models: ModelInfo[]
}

// Legacy flat type — kept so existing imports don't break
export type ProviderInfo = ModelInfo

export async function GET() {
  const hasFal = Boolean(process.env.FAL_KEY)

  // Gemini (Nano Banana) is not listed — fal.ai models are the customer-facing options.
  const groups: ProviderGroup[] = [
    {
      groupId:   "fal",
      groupName: "fal.ai",
      models: [
        {
          id:          "fal-grok",
          name:        "Grok Imagine",
          description: "xAI's image editor — instruction-based editing, no mask needed",
          available:   hasFal,
          badge:       undefined,
        },
        {
          id:          "fal-flux-kontext",
          name:        "FLUX Kontext Pro",
          description: "High-quality instruction-based photo editing, no mask needed",
          available:   hasFal,
          badge:       undefined,
        },
      ],
    },
  ]

  return NextResponse.json(groups)
}
