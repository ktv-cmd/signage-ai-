import { NextResponse } from "next/server"

export interface ProviderInfo {
  id: "fal" | "gemini" | "huggingface"
  name: string
  description: string
  available: boolean
  badge?: string
}

export async function GET() {
  const providers: ProviderInfo[] = [
    {
      id: "fal",
      name: "FLUX.1-fill",
      description: "Edits your real storefront photo — places the sign only in the selected area",
      available: Boolean(process.env.FAL_KEY),
      badge: "Best quality",
    },
    {
      id: "gemini",
      name: "Nano Banana (Gemini)",
      description: "Google's multimodal AI — understands your storefront and logo together",
      available: Boolean(process.env.GEMINI_API_KEY),
      badge: "Requires billing",
    },
    {
      id: "huggingface",
      name: "FLUX Schnell",
      description: "Fast text-to-image — generates a sign from description only",
      available: true, // always available as fallback
    },
  ]

  return NextResponse.json(providers)
}
