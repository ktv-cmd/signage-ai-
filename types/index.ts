export type VariationCount = 1 | 3 | 6

export interface ReferenceStyle {
  id: string
  name: string
  description: string
  imageUrl: string
  // Style metadata baked into each reference
  lightingType: "front" | "back" | "both"
  materialFeel: "brushed-metal" | "acrylic" | "neon" | "dimensional" | "flat"
  depthStyle: "flat" | "shallow" | "deep"
  mountingStyle: "flush" | "stand-off" | "raceway"
  hasBackingPlate: boolean
  compatibleLightModes: ("front" | "back" | "both")[]
}

export interface Placement {
  centerX: number   // normalized 0-1
  centerY: number   // normalized 0-1
  width: number     // normalized 0-1 (60-80% of facade)
  rotation: number  // degrees, typically -10 to +10
  facadeConfidence: number // 0-1, from auto-detection
}

export interface GenerationRequest {
  storefrontImageUrl: string
  brandAssetUrl?: string   // logo upload
  brandText?: string       // typed business name
  references: ReferenceStyle[]
  placement: Placement
  variationCount: VariationCount
}

export interface VariantSpec {
  depthProfile: "flat" | "shallow" | "medium" | "deep"
  edgeProfile: "sharp" | "beveled" | "rounded"
  mountingStyle: "flush" | "stand-off" | "raceway"
  hasBackingPlate: boolean
  materialFeel: string
  lightingMode: "front" | "back" | "both"
  prompt: string
}

export interface Candidate {
  id: string
  variantIndex: number
  imageUrl: string
  spec: VariantSpec
  generatedAt: string
}

export interface AdjustmentSettings {
  faceColor: string          // hex color
  detailColor: string        // trim / returns / outline
  lightColor: string         // light color hex
  lightIntensity: number     // 0-100
  lightingMode: "front" | "back" | "both"
  timeOfDay: "day" | "night"
}

export interface GenerationResult {
  jobId: string
  candidates: Candidate[]
  compatibility: {
    allowedLightModes: ("front" | "back" | "both")[]
  }
}

// Flow state machine
export type FlowStep = "upload" | "placement" | "variations" | "generate" | "select" | "adjust"

export interface FlowState {
  currentStep: FlowStep
  storefrontFile?: File
  storefrontPreviewUrl?: string
  brandAssetFile?: File
  brandAssetPreviewUrl?: string
  brandText?: string
  selectedReferences: ReferenceStyle[]
  placement?: Placement
  variationCount?: VariationCount
  generationResult?: GenerationResult
  selectedCandidateId?: string
  adjustments?: AdjustmentSettings
}
