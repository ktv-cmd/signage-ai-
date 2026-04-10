/**
 * Generates controlled variation specs for 1/3/6 outputs.
 * Uses Gemini (nana banana) if key is available; otherwise deterministic local logic.
 */

import type { ReferenceStyle, VariantSpec, VariationCount } from "@/types"

// Controlled variation axes — bounded, not random
const DEPTH_PROFILES = ["flat", "shallow", "medium", "deep"] as const
const EDGE_PROFILES = ["sharp", "beveled", "rounded"] as const
const MOUNTING_STYLES = ["flush", "stand-off", "raceway"] as const

export type BrandMode = "logo-only" | "text-only" | "logo-and-text"

export async function planVariations(
  references: ReferenceStyle[],
  variationCount: VariationCount,
  brandText: string,
  brandMode: BrandMode = "text-only"
): Promise<VariantSpec[]> {
  const primary = references[0]

  // Always use the local deterministic planner to preserve Gemini quota for image generation.
  return planDeterministic(primary, variationCount, brandText, brandMode)
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
  brandText: string,
  brandMode: BrandMode = "text-only"
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
      prompt: buildPrompt({ brandText, reference, depth, edge, mount, lightMode, brandMode }),
    })
  }

  return specs
}

function buildPrompt({
  brandText,
  reference,
  mount,
  lightMode,
  brandMode,
}: {
  brandText: string
  reference: ReferenceStyle
  depth: string
  edge: string
  mount: string
  lightMode: string
  brandMode: BrandMode
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
    : "individual elements mounted directly onto the facade with no backing panel"

  // ── Brand content — adapts to what the client provided ───────────────────
  let brandContent: string
  if (brandMode === "logo-only") {
    brandContent =
      `BRAND CONTENT — LOGO ONLY: The client provided a logo image (see attached image). ` +
      `Place the logo INSIDE the bounding box as the sole sign face content. ` +
      `Reproduce the logo exactly — same colors, same shapes, same proportions — scaled to fill the sign area. ` +
      `No brand name text, no extra typography. The logo alone is the entire sign content. ` +
      `Use the logo's exact colors for the sign face, letters, and illuminated elements.`
  } else if (brandMode === "text-only") {
    brandContent =
      `BRAND CONTENT — TEXT ONLY: No logo was provided. ` +
      `Display the brand name "${brandText}" as the sign face using clean premium commercial typography. ` +
      `Style the lettering to match the reference sign's aesthetic and material. ` +
      `Choose letter colors that match the reference sign's color palette.`
  } else {
    brandContent =
      `BRAND CONTENT — LOGO AND NAME: The client provided both a logo image and the brand name "${brandText}". ` +
      `Place the logo as the PRIMARY and DOMINANT element of the sign face inside the bounding box — larger, centered or prominently positioned. ` +
      `Add the brand name "${brandText}" as secondary text below or alongside the logo, in typography matching the reference sign style. ` +
      `Use the logo's exact colors for both the logo and the text. ` +
      `The logo must be visually dominant — significantly larger than the text.`
  }

  // ── Final prompt ──────────────────────────────────────────────────────────
  return [
    `TASK: Replace the existing sign or storefront element in the marked bounding box with a new professionally manufactured sign.`,

    brandContent,

    `SIGN STYLE: The reference sign photo is your visual blueprint — match its material, dimensional depth, mounting style, and overall aesthetic exactly. Style: ${reference.name}. Mounting: ${mountDesc}. ${backingDesc}.`,

    `ILLUMINATION: Use the reference photo as the lighting guide — replicate the exact illumination type (front-lit, halo backlight, neon, or unlit), the same light color and temperature, the same glow intensity, and the same light spill onto the wall. ${lightDesc}.`,

    `REPLACEMENT RULE: Whatever is currently in the bounding box must be completely removed and replaced. The new sign fills the entire bounding box, anchored to the facade with correct perspective and mounting hardware.`,

    `PHOTO PRESERVATION — CRITICAL: Every pixel outside the bounding box must be identical to the original photo — same exact colors, same white balance, same exposure, same contrast, same color temperature. Zero color grading, zero tone adjustment, zero enhancement of any kind outside the sign area.`,
  ].join(" ")
}
