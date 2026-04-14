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

/** When false, Gemini (“Nano Banana”) models are omitted from the picker; `/api/generate` still accepts them if called directly. */
const SHOW_GEMINI_MODELS_IN_UI = false

export async function GET() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasFal    = Boolean(process.env.FAL_KEY)

  const geminiGroup: ProviderGroup = {
    groupId:   "gemini",
    groupName: "Nano Banana (Google Gemini)",
    models: [
      {
        id:          "gemini-2.5",
        name:        "Gemini 2.5 Flash",
        description: "Latest model — best quality, multimodal understanding of storefront + logo",
        available:   hasGemini,
        badge:       "Latest",
      },
      {
        id:          "gemini-2.0",
        name:        "Gemini 3.1 Flash",
        description: "Newer alternative model — fast image generation with multimodal support",
        available:   hasGemini,
        badge:       "Fast",
      },
    ],
  }

  const groups: ProviderGroup[] = [
    ...(SHOW_GEMINI_MODELS_IN_UI ? [geminiGroup] : []),
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
