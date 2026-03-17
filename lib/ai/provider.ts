/**
 * AI provider abstraction.
 * Swaps between Hugging Face (dev/free) and fal.ai (production)
 * without changing the calling code.
 */

export type GenerationProvider = "huggingface" | "fal"

export function getActiveProvider(): GenerationProvider {
  if (process.env.FAL_KEY) return "fal"
  if (process.env.HUGGINGFACE_API_KEY) return "huggingface"
  // Fall through to mock mode for local dev without any keys
  return "huggingface"
}

export interface GenerateImageParams {
  prompt: string
  negativePrompt?: string
  referenceImageUrl?: string
  width?: number
  height?: number
}

export interface GenerateImageResult {
  imageUrl: string
  provider: GenerationProvider
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const provider = getActiveProvider()

  if (provider === "fal") {
    return generateWithFal(params)
  }
  return generateWithHuggingFace(params)
}

// ─── fal.ai ──────────────────────────────────────────────────────────────────

async function generateWithFal(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { fal } = await import("@fal-ai/client")

  fal.config({ credentials: process.env.FAL_KEY! })

  const endpoint = params.referenceImageUrl
    ? "fal-ai/flux/dev/image-to-image"
    : "fal-ai/flux/schnell"

  const input = params.referenceImageUrl
    ? {
        image_url: params.referenceImageUrl,
        prompt: params.prompt,
        strength: 0.6,
        num_images: 1,
        num_inference_steps: 28,
      }
    : {
        prompt: params.prompt,
        image_size: { width: params.width ?? 1024, height: params.height ?? 576 },
        num_inference_steps: 4,
        num_images: 1,
      }

  const result = await fal.subscribe(endpoint, { input })

  const url = extractFalImageUrl(result)
  if (!url) throw new Error("fal.ai returned no image")

  return { imageUrl: url, provider: "fal" }
}

function extractFalImageUrl(result: unknown): string | undefined {
  type FalImage = { url?: string }
  type FalResult = {
    images?: FalImage[]
    data?: {
      images?: FalImage[]
      image?: FalImage
      url?: string
    }
  }

  const typed = result as FalResult
  return (
    typed?.images?.[0]?.url ??
    typed?.data?.images?.[0]?.url ??
    typed?.data?.image?.url ??
    typed?.data?.url
  )
}

// ─── Hugging Face ─────────────────────────────────────────────────────────────

async function generateWithHuggingFace(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const token = process.env.HUGGINGFACE_API_KEY

  // If no token, return a mock placeholder for local development
  if (!token) {
    return mockGenerate(params)
  }

  const response = await fetch(
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: params.prompt,
        parameters: {
          negative_prompt: params.negativePrompt,
          width: params.width ?? 1024,
          height: params.height ?? 576,
        },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace error: ${err}`)
  }

  const blob = await response.blob()
  // Convert blob to base64 data URL for storage
  const buffer = Buffer.from(await blob.arrayBuffer())
  const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`

  return { imageUrl: dataUrl, provider: "huggingface" }
}

// ─── Mock (no API keys) ───────────────────────────────────────────────────────

async function mockGenerate(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  // Returns a placeholder gradient image URL for UI development
  const seed = encodeURIComponent(params.prompt.slice(0, 20))
  return {
    imageUrl: `https://picsum.photos/seed/${seed}/1024/576`,
    provider: "huggingface",
  }
}
