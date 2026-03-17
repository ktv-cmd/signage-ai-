/**
 * Generates controlled variation specs for 1/3/6 outputs.
 * Uses OpenAI if key is available; otherwise uses deterministic local logic.
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

  if (process.env.OPENAI_API_KEY) {
    return planWithOpenAI(primary, variationCount, brandText)
  }

  return planDeterministic(primary, variationCount, brandText)
}

// ─── OpenAI planner ───────────────────────────────────────────────────────────

async function planWithOpenAI(
  reference: ReferenceStyle,
  count: VariationCount,
  brandText: string
): Promise<VariantSpec[]> {
  const OpenAI = (await import("openai")).default
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `You are a sign design variation planner. 
You produce ${count} controlled, distinct but style-consistent variation specs for storefront sign mockups.
Each variation must differ in: depth, edge profile, mounting, or backing plate. 
Keep all within the spirit of the reference style. Never produce random unrelated variations.
Return only valid JSON array of VariantSpec objects.`

  const userPrompt = `Reference style: ${reference.name}
- Material: ${reference.materialFeel}
- Depth: ${reference.depthStyle}
- Mounting: ${reference.mountingStyle}
- Lighting: ${reference.lightingType}
- Backing plate: ${reference.hasBackingPlate}
Brand text: "${brandText}"

Generate ${count} variation specs. Each must include:
depthProfile (flat|shallow|medium|deep), edgeProfile (sharp|beveled|rounded), 
mountingStyle (flush|stand-off|raceway), hasBackingPlate (bool), 
materialFeel (string), lightingMode (${reference.compatibleLightModes.join("|")}), 
prompt (detailed photorealistic prompt for image generation)`

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
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
  return [
    `Photorealistic storefront sign for "${brandText}".`,
    `Style: ${reference.name}.`,
    `${depth} dimensional letters with ${edge} edge profile.`,
    `${mount} mounting style.`,
    reference.hasBackingPlate ? "Mounted on a backing panel." : "No backing plate, letters directly on facade.",
    `Material: ${reference.materialFeel}.`,
    `${lightMode} lighting.`,
    "High-quality architectural photography, sharp details, professional commercial photography.",
    "No text errors. Clean, premium result.",
  ].join(" ")
}
