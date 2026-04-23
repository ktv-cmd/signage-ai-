import { NextResponse } from "next/server"
import type { GenerationProvider } from "@/lib/ai/provider"

export interface ModelInfo {
  id: GenerationProvider
  name: string
  description: string
  available: boolean
}

export interface ProviderGroup {
  groupId: string
  groupName: string
  models: ModelInfo[]
}

/** @deprecated Use `ModelInfo` — kept for imports that still expect this name */
export type ProviderInfo = ModelInfo

export async function GET() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY)
  const hasFal = Boolean(process.env.FAL_KEY)

  const groups: ProviderGroup[] = [
    {
      groupId: "gemini",
      groupName: "Nano Banana (Google Gemini)",
      models: [
        {
          id: "gemini-2.5",
          name: "Gemini 2.5 Flash",
          description:
            "Image model for storefront, logo, and style references (Nano Banana)",
          available: hasGemini,
        },
      ],
    },
    {
      groupId: "fal",
      groupName: "fal.ai",
      models: [
        {
          id: "fal-grok",
          name: "Grok Imagine",
          description:
            "xAI Grok Imagine on fal — inpaints your painted sign area on the building photo",
          available: hasFal,
        },
        {
          id: "fal-flux-kontext",
          name: "FLUX Kontext (fal)",
          description:
            "Instruction-style workflow on fal — same guided storefront and fill region as other fal routes",
          available: hasFal,
        },
        {
          id: "fal",
          name: "SDXL Inpaint",
          description: "Classic inpainting — edits only the sign region you painted",
          available: hasFal,
        },
      ],
    },
    {
      groupId: "more",
      groupName: "Other engines",
      models: [
        {
          id: "replicate",
          name: "FLUX Kontext Pro",
          description:
            "Replicate-hosted Kontext Pro — needs a Replicate API token",
          available: Boolean(process.env.REPLICATE_API_TOKEN),
        },
        {
          id: "huggingface",
          name: "FLUX Schnell",
          description:
            "Text-to-image on Hugging Face — optional API token; without one you may get a placeholder preview",
          available: true,
        },
      ],
    },
  ]

  return NextResponse.json(groups)
}
