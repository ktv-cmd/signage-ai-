import { NextResponse } from "next/server"

export interface ProviderInfo {
  id: "fal" | "gemini" | "replicate" | "huggingface"
  name: string
  description: string
  available: boolean
  badge?: string
}

export async function GET() {
  const providers: ProviderInfo[] = [
    {
      id: "replicate",
      name: "FLUX Kontext Pro",
      description: "Instruction-based photo editing — places your sign directly from a text prompt",
      available: Boolean(process.env.REPLICATE_API_TOKEN),
      badge: "$0.04 / image",
    },
    {
      id: "gemini",
      name: "Nano Banana (Gemini)",
      description: "Google's multimodal AI — understands your storefront and logo together",
      available: Boolean(process.env.GEMINI_API_KEY),
      badge: "Recommended",
    },
    {
      id: "fal",
      name: "SDXL Inpaint",
      description: "Mask-based inpainting via fal.ai — free tier, edits only the sign area",
      available: Boolean(process.env.FAL_KEY),
      badge: "Free",
    },
  ]

  return NextResponse.json(providers)
}
