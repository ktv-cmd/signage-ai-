"use client"

import { create } from "zustand"
import type { GenerationProvider } from "@/lib/ai/provider"
import type { FlowState, FlowStep, ReferenceStyle, Placement, VariationCount, GenerationResult, AdjustmentSettings, TextStyling } from "@/types"

interface FlowStore extends FlowState {
  // Step navigation
  goToStep: (step: FlowStep) => void
  goNext: () => void
  goBack: () => void

  // Step 1: Upload
  setStorefront: (file: File, previewUrl: string) => void
  setBrandAsset: (file: File, previewUrl: string) => void
  setBrandText: (text: string) => void
  setTextStyling: (styling: TextStyling) => void
  clearBrandAsset: () => void
  setSelectedReferences: (refs: ReferenceStyle[]) => void
  selectReference: (ref: ReferenceStyle) => void

  // Step 2: Placement
  setPlacement: (placement: Placement) => void
  setPlacementBrushFile: (file: File | undefined) => void

  // Step 3: Variations
  setVariationCount: (count: VariationCount) => void

  // Model selector
  setSelectedProvider: (provider: GenerationProvider) => void

  // Lead capture
  setLeadId: (id: string) => void

  // Step 4/5: Generation + Selection
  setGenerationResult: (result: GenerationResult) => void
  setSelectedCandidate: (id: string) => void

  // Step 6: Adjust
  setAdjustments: (settings: Partial<AdjustmentSettings>) => void

  reset: () => void
}

const STEP_ORDER: FlowStep[] = ["upload", "placement", "variations", "generate", "download"]

const DEFAULT_ADJUSTMENTS: AdjustmentSettings = {
  faceColor: "#C0C0C0",
  detailColor: "#1A1A1A",
  lightColor: "#FFFFFF",
  lightIntensity: 70,
  lightingMode: "front",
  timeOfDay: "day",
}

const DEFAULT_PLACEMENT: Placement = {
  centerX: 0.5,
  centerY: 0.22,
  width: 0.68,
  height: 0.14,
  rotation: 0,
  facadeConfidence: 0.85,
}

const initialState: FlowState = {
  currentStep: "upload",
  selectedReferences: [],
  variationCount: 1,
  placement: DEFAULT_PLACEMENT,
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  ...initialState,

  goToStep: (step) => set({ currentStep: step }),

  goNext: () => {
    const { currentStep, variationCount } = get()
    const currentIndex = STEP_ORDER.indexOf(currentStep)
    let nextStep = STEP_ORDER[currentIndex + 1]

    // Enable variations step — users can choose output count
    if (currentStep === "placement") {
      nextStep = "variations"
    }

    // Always go to download page (merged select + download)
    if (nextStep === "select") {
      nextStep = "download"
    }

    if (nextStep) set({ currentStep: nextStep })
  },

  goBack: () => {
    const { currentStep, variationCount } = get()
    const currentIndex = STEP_ORDER.indexOf(currentStep)
    let previousStep = STEP_ORDER[currentIndex - 1]

    // Enable variations step — users can choose output count
    if (currentStep === "generate") {
      previousStep = "variations"
    }

    // Skip back from download to generate
    if (previousStep === "select") {
      previousStep = "generate"
    }

    if (previousStep) set({ currentStep: previousStep })
  },

  setStorefront: (file, previewUrl) =>
    set({ storefrontFile: file, storefrontPreviewUrl: previewUrl }),

  setBrandAsset: (file, previewUrl) =>
    set({ brandAssetFile: file, brandAssetPreviewUrl: previewUrl }),

  setBrandText: (text) => {
    const state = get()
    set({ 
      brandText: text,
      // Auto-initialize textStyling with defaults when brandText is set (text-only mode)
      textStyling: state.textStyling || { fontStyle: "modern-sans", color: "#C0C0C0" }
    })
  },

  setTextStyling: (textStyling) =>
    set({ textStyling }),

  clearBrandAsset: () =>
    set({ brandAssetFile: undefined, brandAssetPreviewUrl: undefined }),

  setSelectedReferences: (refs) => set({ selectedReferences: refs }),

  selectReference: (ref) => set({ selectedReferences: [ref] }),

  setPlacement: (placement) => set({ placement }),

  setPlacementBrushFile: (placementBrushFile) => set({ placementBrushFile }),

  setVariationCount: (variationCount) => set({ variationCount }),

  setSelectedProvider: (selectedProvider) => set({ selectedProvider }),

  setLeadId: (leadId) => set({ leadId }),

  setGenerationResult: (result) => {
    const { variationCount } = get()
    // Auto-select if only 1 candidate
    const autoSelected = variationCount === 1 ? result.candidates[0]?.id : undefined
    set({
      generationResult: result,
      selectedCandidateId: autoSelected,
      adjustments: {
        ...DEFAULT_ADJUSTMENTS,
        lightingMode: result.compatibility.allowedLightModes[0] ?? "front",
      },
    })
  },

  setSelectedCandidate: (id) => set({ selectedCandidateId: id }),

  setAdjustments: (settings) =>
    set((state) => ({
      adjustments: { ...(state.adjustments ?? DEFAULT_ADJUSTMENTS), ...settings },
    })),

  reset: () => set(initialState),
}))
