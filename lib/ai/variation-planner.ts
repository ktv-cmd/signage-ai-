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

  // ── Mounting description ──────────────────────────────────────────────────
  const mountMap: Record<string, string> = {
    "flush":     "flush-mounted directly against the facade surface",
    "stand-off": "stand-off mounted with visible metal studs creating a floating shadow gap between letters and wall",
    "raceway":   "raceway-mounted on a metal wireway box fixed to the facade",
  }
  const mountDesc = mountMap[mount] ?? `${mount}-mounted`

  // ── Lighting description ──────────────────────────────────────────────────
  const lightMap: Record<string, string> = {
    front: "internally LED front-lit, even face illumination with soft light spill onto surrounding facade",
    back:  "LED halo backlit, glowing halo between letters and wall surface",
    both:  "dual LED lit — bright face illumination combined with a rear halo glow",
    neon:  "exposed neon tube lighting with vivid colored light and characteristic glass glow",
  }
  const lightDesc = lightMap[lightMode] ?? `${lightMode} illuminated`

  // ── Backing plate ─────────────────────────────────────────────────────────
  const backingDesc = reference.hasBackingPlate
    ? "mounted on a rectangular backing panel that frames the sign cleanly against the wall"
    : "individual letters or logo mounted directly onto the facade with no backing panel"

  // ── Final prompt ──────────────────────────────────────────────────────────
  return [
    `TASK: Replace the existing sign or storefront element in the marked bounding box with a new professionally manufactured sign for "${brandText}".`,

    `BRAND CONTENT: If a brand logo is provided in the images, place it as the sign face — reproduce the logo exactly with its correct colors and proportions. If no logo, display the brand name "${brandText}" in clean premium commercial typography.`,

    `BRAND COLORS: The sign must use the exact colors from the brand logo. Do not invent colors. The sign face, letters, and any illuminated elements must match the brand's color palette precisely.`,

    `SIGN STYLE: Closely match the reference sign photo — same material, same dimensional depth, same mounting style, same overall aesthetic. Style: ${reference.name}. Mounting: ${mountDesc}. ${backingDesc}.`,

    `ILLUMINATION: ${lightDesc}. Light must interact realistically with the wall — soft shadows, ambient spill, realistic reflections on nearby surfaces.`,

    `REPLACEMENT RULE: Whatever is currently in the bounding box must be completely removed and replaced. The new sign fills the entire box area, anchored to the facade with correct perspective and mounting hardware.`,

    `PRESERVE EVERYTHING ELSE: Every pixel outside the bounding box must be identical to the original photo — same walls, same sky, same street, same windows, zero changes.`,
  ].join(" ")
}
