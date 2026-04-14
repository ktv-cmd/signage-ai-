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
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasFal    = Boolean(process.env.FAL_KEY)

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

  // hasGemini is kept so the env-var check remains valid for server-side logic
  void hasGemini

  return NextResponse.json(groups)
}
