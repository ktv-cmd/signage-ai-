"use client"

import { create } from "zustand"
import type { FlowState, FlowStep, ReferenceStyle, Placement, VariationCount, GenerationResult, AdjustmentSettings } from "@/types"

interface FlowStore extends FlowState {
  // Step navigation
  goToStep: (step: FlowStep) => void
  goNext: () => void
  goBack: () => void

  // Step 1: Upload
  setStorefront: (file: File, previewUrl: string) => void
  setBrandAsset: (file: File, previewUrl: string) => void
  setBrandText: (text: string) => void
  clearBrandAsset: () => void
  setSelectedReferences: (refs: ReferenceStyle[]) => void
  toggleReference: (ref: ReferenceStyle) => void

  // Step 2: Placement
  setPlacement: (placement: Placement) => void

  // Step 3: Variations
  setVariationCount: (count: VariationCount) => void

  // Model selector
  setSelectedProvider: (provider: "fal" | "gemini" | "huggingface") => void

  // Step 4/5: Generation + Selection
  setGenerationResult: (result: GenerationResult) => void
  setSelectedCandidate: (id: string) => void

  // Step 6: Adjust
  setAdjustments: (settings: Partial<AdjustmentSettings>) => void

  reset: () => void
}

const STEP_ORDER: FlowStep[] = ["upload", "placement", "variations", "generate", "select", "adjust"]

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

    // Skip variations step only — placement is active.
    if (currentStep === "placement") {
      nextStep = "generate"
    }

    // Skip "select" step if variationCount === 1
    if (nextStep === "select" && variationCount === 1) {
      nextStep = "adjust"
    }

    if (nextStep) set({ currentStep: nextStep })
  },

  goBack: () => {
    const { currentStep, variationCount } = get()
    const currentIndex = STEP_ORDER.indexOf(currentStep)
    let previousStep = STEP_ORDER[currentIndex - 1]

    // Skip variations step only — placement is active.
    if (currentStep === "generate") {
      previousStep = "placement"
    }

    // Skip hidden "select" step when variationCount is 1.
    if (previousStep === "select" && variationCount === 1) {
      previousStep = "generate"
    }

    if (previousStep) set({ currentStep: previousStep })
  },

  setStorefront: (file, previewUrl) =>
    set({ storefrontFile: file, storefrontPreviewUrl: previewUrl }),

  setBrandAsset: (file, previewUrl) =>
    set({ brandAssetFile: file, brandAssetPreviewUrl: previewUrl }),

  setBrandText: (text) =>
    set({ brandText: text }),

  clearBrandAsset: () =>
    set({ brandAssetFile: undefined, brandAssetPreviewUrl: undefined }),

  setSelectedReferences: (refs) => set({ selectedReferences: refs }),

  toggleReference: (ref) => {
    const current = get().selectedReferences
    const exists = current.some((r) => r.id === ref.id)
    if (exists) {
      set({ selectedReferences: current.filter((r) => r.id !== ref.id) })
    } else {
      set({ selectedReferences: [...current, ref] })
    }
  },

  setPlacement: (placement) => set({ placement }),

  setVariationCount: (variationCount) => set({ variationCount }),

  setSelectedProvider: (selectedProvider) => set({ selectedProvider }),

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
