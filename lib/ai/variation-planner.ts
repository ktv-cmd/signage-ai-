/**
 * Generates controlled variation specs for 1/3/6 outputs.
 * Uses Gemini (nana banana) if key is available; otherwise deterministic local logic.
 */

import type { ReferenceStyle, VariantSpec, VariationCount, FontStyle, TextStyling } from "@/types"

// Controlled variation axes — bounded, not random
const DEPTH_PROFILES = ["flat", "shallow", "medium", "deep"] as const
const EDGE_PROFILES = ["sharp", "beveled", "rounded"] as const
const MOUNTING_STYLES = ["flush", "stand-off", "raceway"] as const

export type BrandMode = "logo-only" | "text-only" | "logo-and-text"

export async function planVariations(
  references: ReferenceStyle[],
  variationCount: VariationCount,
  brandText: string,
  brandMode: BrandMode = "text-only",
  textStyling?: TextStyling
): Promise<VariantSpec[]> {
  const primary = references[0]

  // Always use the local deterministic planner to preserve Gemini quota for image generation.
  return planDeterministic(primary, variationCount, brandText, brandMode, textStyling)
}

// Font style descriptions for prompts
function getFontDescription(fontStyle?: FontStyle): string {
  const fontMap: Record<FontStyle, string> = {
    "modern-sans": "Modern sans-serif typeface (geometric, clean lines, contemporary feel). Similar to Futura, Avant Garde, or Gotham.",
    "classic-serif": "Classic serif typeface (traditional, elegant, timeless). Similar to Trajan, Times Roman, or Garamond. Well-proportioned with refined serifs.",
    "bold-condensed": "Bold condensed sans-serif (industrial, impactful, space-efficient). Similar to Impact, Univers Condensed, or Trade Gothic Bold. Tight letter spacing, strong presence.",
  }
  return fontStyle ? fontMap[fontStyle] : "Professional signage typeface appropriate for the selected style"
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
  brandMode: BrandMode = "text-only",
  textStyling?: TextStyling
): VariantSpec[] {
  // ═══════════════════════════════════════════════════════════════
  // SAFETY VALIDATION RULES
  // ═══════════════════════════════════════════════════════════════
  
  // 1. COLOR VALIDATION: Ensure valid color with fallback
  const finalColor = textStyling?.color || "#C0C0C0" // Default: brushed silver (most common)
  const validatedTextStyling: TextStyling = {
    fontStyle: textStyling?.fontStyle || "modern-sans",
    color: finalColor
  }
  
  // 3. AWNING OVERRIDE: Awnings MUST be internally lit (no external lights)
  const isAwning = reference.id === "awning"
  if (isAwning) {
    console.log('[SAFETY] Awning detected - forcing internal/natural lighting mode')
    reference = {
      ...reference,
      lightingType: "front", // Internal glow (will be overridden in prompt to natural light)
      compatibleLightModes: ["front"] // Single mode for awnings
    }
  }
  
  // 4. LOGO ASSET CHECK: Use validated styling
  const effectiveTextStyling = brandMode === "text-only" || brandMode === "logo-and-text" 
    ? validatedTextStyling 
    : undefined
  
  // ═══════════════════════════════════════════════════════════════
  
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
      prompt: buildPrompt({ 
        brandText, 
        reference, 
        depth, 
        edge, 
        mount, 
        lightMode, 
        brandMode, 
        textStyling: effectiveTextStyling // Use validated styling
      }),
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
  textStyling,
}: {
  brandText: string
  reference: ReferenceStyle
  depth: string
  edge: string
  mount: string
  lightMode: string
  brandMode: BrandMode
  textStyling?: TextStyling
}): string {
  const isAwning = reference.id === "awning"
  const isLightBox = reference.id === "light-box"
  
  // Get descriptive parts
  const signType = getSignTypeDescription(isAwning, isLightBox)
  const fontDesc = getFontStyleDescription(textStyling?.fontStyle)
  const colorDesc = getColorDescription(textStyling?.color, brandMode)
  const lightDesc = getLightingDescription(lightMode, isAwning)
  const mountDesc = getMountingDescription(mount)
  
  // Build the content description based on brand mode
  const contentDesc = brandMode === "logo-only"
    ? `the logo from Image 2`
    : brandMode === "text-only"
    ? `the text '${brandText}'`
    : `the logo from Image 2 alongside the text '${brandText}'`
  
  // Awning special case - with specific color rules per brand mode
  if (isAwning) {
    const awningColorDesc = getAwningColorDescription(brandMode, textStyling?.color)
    
    return [
      `Generate a photorealistic architectural photo of the storefront.`,
      `Inside the area marked by the yellow highlight, place a new, professional fabric awning that clearly displays ${contentDesc}.`,
      ``,
      `The awning must be made of heavyweight canvas fabric with natural draping and visible texture.`,
      `The graphics should appear screen-printed or vinyl-applied onto the fabric surface, following the curves of the material.`,
      ``,
      awningColorDesc,
      ``,
      `The awning must be properly anchored to the building with a visible metal frame—do not let it float.`,
      `Use natural daylight only—no artificial glow or internal illumination.`,
      `Completely replace the yellow highlighted area with this new awning, restoring any visible wall texture around it.`,
    ].filter(Boolean).join(" ")
  }
  
  // Light box special case
  if (isLightBox) {
    return [
      `Generate a photorealistic architectural photo of the storefront.`,
      `Inside the area marked by the yellow highlight, place a new, high-end illuminated light box sign that clearly displays ${contentDesc}.`,
      ``,
      `The sign must be a sleek aluminum cabinet with a translucent acrylic face panel.`,
      colorDesc,
      `The cabinet should have visible depth with crisp edges and internal LED illumination creating an even, soft glow.`,
      ``,
      `Ensure the sign is physically mounted to the wall with visible brackets—do not let it float.`,
      `The sign must cast realistic shadows and integrate seamlessly with the building's architecture.`,
      `Completely replace the yellow highlighted area with this new signage, restoring the wall texture around it.`,
    ].filter(Boolean).join(" ")
  }
  
  // Channel letters (default) - clean, direct prompt
  return [
    `Generate a photorealistic architectural photo of the storefront.`,
    `Inside the area marked by the yellow highlight, place a new, high-end ${signType} sign that clearly reads ${contentDesc}.`,
    ``,
    `The sign must be dimensional, 3D channel letters${fontDesc}.`,
    colorDesc,
    `The sign must have ${lightDesc}.`,
    ``,
    `Ensure the new signage is physically ${mountDesc}—do not let it float.`,
    `The text must be sharp, legible, and integrated into the building's facade.`,
    `Completely replace the yellow highlighted area with this new signage, restoring the wall texture around it.`,
  ].filter(Boolean).join(" ")
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function getSignTypeDescription(isAwning: boolean, isLightBox: boolean): string {
  if (isAwning) return "fabric awning"
  if (isLightBox) return "illuminated cabinet"
  return "channel letter"
}

function getFontStyleDescription(fontStyle?: FontStyle): string {
  const fontMap: Record<FontStyle, string> = {
    "modern-sans": " with a modern, clean sans-serif font",
    "classic-serif": " with an elegant, classic serif font",
    "bold-condensed": " with a bold, condensed industrial font",
  }
  return fontStyle ? fontMap[fontStyle] : " with a professional, modern font"
}

function getColorDescription(color?: string, brandMode?: BrandMode): string {
  if (brandMode === "logo-only") {
    return "The colors must match exactly the logo provided in Image 2."
  }
  if (color) {
    return `The letters should be ${color}.`
  }
  return "The letters should complement the building's color palette—brushed aluminum, matte black, or bronze."
}

function getLightingDescription(lightMode: string, isAwning: boolean): string {
  if (isAwning) {
    return "natural daylight illumination only"
  }
  
  const lightMap: Record<string, string> = {
    front: "front-lit illumination (glowing letter faces)",
    back: "back-lit illumination (halo glow behind the letters)",
    both: "front and back-lit illumination",
    neon: "no artificial illumination (natural shadows only)",
  }
  
  return lightMap[lightMode] ?? "professional illumination"
}

function getMountingDescription(mount: string): string {
  const mountMap: Record<string, string> = {
    flush: "mounted flush to the wall with visible brackets",
    "stand-off": "mounted to the wall with visible stand-off pins",
    raceway: "mounted on a visible raceway rail",
  }
  
  return mountMap[mount] ?? "mounted to the wall with visible brackets"
}

// ─── AWNING COLOR RULES ──────────────────────────────────────────────────────
// Text-only: Awning fabric = user's selected color, Text = white/neutral
// Logo-only: Awning fabric = color that matches/complements the logo
// Logo+Text: Same as logo-only (awning matches logo, text in neutral)

function getAwningColorDescription(brandMode: BrandMode, userColor?: string): string {
  if (brandMode === "text-only") {
    // AWNING + NAME ONLY: Awning in selected color, text in white/neutral
    const awningColor = userColor || "a rich, professional color that complements the building"
    return [
      `AWNING COLOR: The awning fabric must be ${awningColor}.`,
      `TEXT COLOR: The business name text must be white or cream—a clean, neutral color that stands out clearly against the colored awning fabric.`,
      `The contrast between the colored awning and white text should be sharp and highly legible.`,
    ].join(" ")
  }
  
  if (brandMode === "logo-only") {
    // AWNING + LOGO ONLY: Awning color matches/complements the logo
    return [
      `AWNING COLOR: Analyze the logo in Image 2 and choose an awning fabric color that complements and harmonizes with the logo's color palette.`,
      `The awning should feel like a natural extension of the brand—pick a color from the logo or a complementary shade that looks professional and cohesive.`,
      `LOGO COLORS: The logo must retain its exact original colors from Image 2.`,
    ].join(" ")
  }
  
  // AWNING + LOGO + TEXT: Same as logo-only (awning matches logo)
  return [
    `AWNING COLOR: Analyze the logo in Image 2 and choose an awning fabric color that complements and harmonizes with the logo's color palette.`,
    `The awning should feel like a natural extension of the brand—pick a color from the logo or a complementary shade that looks professional and cohesive.`,
    `LOGO COLORS: The logo must retain its exact original colors from Image 2.`,
    `TEXT COLOR: The business name text should be white or cream—a clean, neutral color that contrasts well with the awning and complements the logo.`,
  ].join(" ")
}

