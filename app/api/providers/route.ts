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
      id: "gemini",
      name: "Nano Banana (Gemini)",
      description: "Google's multimodal AI — understands your storefront and logo together",
      available: Boolean(process.env.GEMINI_API_KEY),
      badge: "Recommended",
    },
    {
      id: "fal",
      name: "FLUX.1-fill",
      description: "Inpainting via fal.ai — requires a Pro plan API key",
      available: Boolean(process.env.FAL_KEY),
      badge: "Pro plan required",
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
