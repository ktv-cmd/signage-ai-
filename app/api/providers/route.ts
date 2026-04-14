import { NextResponse } from "next/server"
import type { GenerationProvider } from "@/lib/ai/provider"

export interface ModelInfo {
  id: GenerationProvider
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

  // Nano Banana (Gemini) models are intentionally omitted from the picker; `/api/generate` still accepts them if called directly.

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
