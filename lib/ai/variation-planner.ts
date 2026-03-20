/**
 * Generates controlled variation specs for 1/3/6 outputs.
 * Uses Gemini (nana banana) if key is available; otherwise deterministic local logic.
 */

import type { ReferenceStyle, VariantSpec, VariationCount } from "@/types"

// Controlled variation axes — bounded, not random
const DEPTH_PROFILES = ["flat", "shallow", "medium", "deep"] as const
const EDGE_PROFILES = ["sharp", "beveled", "rounded"] as const
const MOUNTING_STYLES = ["flush", "stand-off", "raceway"] as const

export async function planVariations(
  references: ReferenceStyle[],
  variationCount: VariationCount,
  brandText: string
): Promise<VariantSpec[]> {
  const primary = references[0]

  // Always use the local deterministic planner to preserve Gemini quota for image generation.
  return planDeterministic(primary, variationCount, brandText)
}

// ─── Gemini planner ───────────────────────────────────────────────────────────

async function planWithGemini(
  reference: ReferenceStyle,
  count: VariationCount,
  brandText: string
): Promise<VariantSpec[]> {
  const { GoogleGenAI } = await import("@google/genai")
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const prompt = `You are a professional sign design variation planner.
Generate exactly ${count} controlled, distinct but style-consistent variation specs for a storefront sign mockup.

Reference style: ${reference.name}
- Material: ${reference.materialFeel}
- Depth: ${reference.depthStyle}
- Mounting: ${reference.mountingStyle}
- Lighting: ${reference.lightingType}
- Backing plate: ${reference.hasBackingPlate}
Brand text: "${brandText}"

Each variation must differ in at least one of: depth, edge profile, mounting, or backing plate.
All variations must stay within the spirit of the reference style.

Return a JSON array of exactly ${count} objects. Each object must have these fields:
- depthProfile: "flat" | "shallow" | "medium" | "deep"
- edgeProfile: "sharp" | "beveled" | "rounded"
- mountingStyle: "flush" | "stand-off" | "raceway"
- hasBackingPlate: boolean
- materialFeel: string
- lightingMode: ${JSON.stringify(reference.compatibleLightModes)}  — pick one
- prompt: a detailed single-sentence photorealistic image generation prompt describing the sign installed on the storefront

Return only the raw JSON array, no markdown, no explanation.`

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", temperature: 0.4 },
  })

  const raw = response.text ?? ""
  const parsed = JSON.parse(raw)
  const specs: VariantSpec[] = Array.isArray(parsed) ? parsed : parsed.variations ?? []
  return specs.slice(0, count)
}

// ─── Deterministic fallback ───────────────────────────────────────────────────

function planDeterministic(
  reference: ReferenceStyle,
  count: VariationCount,
  brandText: string
): VariantSpec[] {
  const specs: VariantSpec[] = []

  const depthMatrix = {
    1: [reference.depthStyle],
    3: ["shallow", "medium", "deep"],
    6: ["flat", "shallow", "medium", "medium", "deep", "deep"],
  }[count]

  const edgeMatrix = {
    1: ["sharp"],
    3: ["sharp", "beveled", "rounded"],
    6: ["sharp", "sharp", "beveled", "beveled", "rounded", "rounded"],
  }[count]

  const mountMatrix = {
    1: [reference.mountingStyle],
    3: [reference.mountingStyle, "stand-off", "flush"],
    6: ["flush", "stand-off", "raceway", "flush", "stand-off", "raceway"],
  }[count]

  for (let i = 0; i < count; i++) {
    const depth = depthMatrix[i] as VariantSpec["depthProfile"]
    const edge = edgeMatrix[i] as VariantSpec["edgeProfile"]
    const mount = mountMatrix[i] as VariantSpec["mountingStyle"]
    const lightMode = reference.compatibleLightModes[i % reference.compatibleLightModes.length]

    specs.push({
      depthProfile: depth,
      edgeProfile: edge,
      mountingStyle: mount,
      hasBackingPlate: i % 3 === 2 ? !reference.hasBackingPlate : reference.hasBackingPlate,
      materialFeel: reference.materialFeel,
      lightingMode: lightMode,
      prompt: buildPrompt({ brandText, reference, depth, edge, mount, lightMode }),
    })
  }

  return specs
}

function buildPrompt({
  brandText,
  reference,
  depth,
  edge,
  mount,
  lightMode,
}: {
  brandText: string
  reference: ReferenceStyle
  depth: string
  edge: string
  mount: string
  lightMode: string
}): string {

  // ── Material description ──────────────────────────────────────────────────
  const materialMap: Record<string, string> = {
    "brushed-metal":  "brushed aluminum faces with a fine directional grain, matte silver sheen",
    "acrylic":        "smooth frosted acrylic faces, semi-translucent with an even internal glow",
    "flat":           "precision laser-cut flat aluminum, powder-coated matte finish",
    "neon":           "exposed bent glass neon tubes, vibrant colored light emission",
    "dimensional":    "deep matte powder-coated aluminum dimensional letters, luxury dark finish",
  }
  const materialDesc = materialMap[reference.materialFeel] ?? `${reference.materialFeel} finish`

  // ── Depth description ─────────────────────────────────────────────────────
  const depthMap: Record<string, string> = {
    flat:    "flat cut letters with zero depth, flush to the surface",
    shallow: "shallow 1-inch channel letters with slight dimensional presence",
    medium:  "medium 3-inch channel letters with clear dimensional depth",
    deep:    "deep 5-inch channel letters with strong three-dimensional projection",
  }
  const depthDesc = depthMap[depth] ?? `${depth} depth channel letters`

  // ── Mounting description ──────────────────────────────────────────────────
  const mountMap: Record<string, string> = {
    "flush":     "flush-mounted directly against the facade surface",
    "stand-off": "stand-off mounted with visible metal studs creating a floating shadow gap between letters and wall",
    "raceway":   "raceway-mounted on a metal wireway box fixed to the facade",
  }
  const mountDesc = mountMap[mount] ?? `${mount}-mounted`

  // ── Lighting description ──────────────────────────────────────────────────
  const lightMap: Record<string, string> = {
    front: "internally LED front-lit with warm white 3000K LEDs, even face illumination, soft light spill onto facade",
    back:  "LED halo backlit, creating a floating glow effect between letters and wall surface, 4000K cool white halo",
    both:  "dual LED lit — front face illumination plus rear halo backlight creating a layered glowing effect",
    neon:  "exposed neon tube lighting, vivid colored light, characteristic glass tube glow and subtle buzz",
  }
  const lightDesc = lightMap[lightMode] ?? `${lightMode} illuminated`

  // ── Backing plate ─────────────────────────────────────────────────────────
  const backingDesc = reference.hasBackingPlate
    ? "mounted on a brushed metal rectangular backing panel that frames the letters cleanly"
    : "individual letters mounted directly onto the facade wall with no backing panel"

  // ── Final prompt ──────────────────────────────────────────────────────────
  return [
    `TASK: Add a brand-new professionally manufactured illuminated business sign displaying the text "${brandText}" onto the storefront shown in the photo.`,

    `SIGN CONSTRUCTION: ${depthDesc}, ${edge} edge profile, ${materialDesc}.`,

    `MOUNTING: ${mountDesc}. ${backingDesc}.`,

    `ILLUMINATION: ${lightDesc}. The light source must interact realistically with the facade surface — casting soft shadows, creating ambient light spill on surrounding wall, and reflecting subtly on nearby glass or surfaces.`,

    `SIGN STYLE: ${reference.name}. Match the aesthetic precisely — this is a modern, premium commercial sign produced by a professional signage manufacturer.`,

    `TECHNICAL QUALITY: The sign must look like a real physical object bolted to the real wall in the photo. Correct perspective matching. Accurate shadow casting from the sign depth onto the wall. Mounting hardware (screws, studs, or raceway box) must be visible and realistic. Zero text errors — every letter perfectly formed and spaced.`,

    `OUTPUT: One photorealistic architectural exterior photo showing the completed storefront with the new sign installed. Professional commercial photography quality.`,
  ].join(" ")
}
