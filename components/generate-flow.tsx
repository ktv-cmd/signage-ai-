"use client"

import { useFlowStore } from "@/lib/flow-store"
import { StepIndicator } from "./step-indicator"
import { StepUpload } from "./steps/step-upload"
import { StepPlacement } from "./steps/step-placement"
import { StepVariations } from "./steps/step-variations"
import { StepGenerate } from "./steps/step-generate"
import { StepSelect } from "./steps/step-select"
import { StepAdjust } from "./steps/step-adjust"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const STEP_LABELS = {
  upload: "Upload",
  placement: "Placement",
  variations: "Variations",
  generate: "Generate",
  select: "Select",
  adjust: "Adjust",
}

export function GenerateFlow() {
  const router = useRouter()
  const { currentStep, variationCount, goBack } = useFlowStore()

  // Build visible steps (skip "select" if variationCount === 1)
  const allSteps = ["upload", "placement", "variations", "generate", "select", "adjust"] as const
  const visibleSteps = allSteps.filter(
    (s) => !(s === "variations" || (s === "select" && variationCount === 1))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (currentStep === "upload") {
                router.push("/")
                return
              }
              goBack()
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <span className="font-semibold text-sm text-gray-900">Sign Generator</span>
          </div>
          <div className="w-16" />
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-4">
          <StepIndicator
            steps={visibleSteps.map((s) => ({ id: s, label: STEP_LABELS[s] }))}
            currentStep={currentStep}
          />
        </div>
      </header>

      {/* Step content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {currentStep === "upload" && <StepUpload />}
        {currentStep === "placement" && <StepPlacement />}
        {currentStep === "variations" && <StepVariations />}
        {currentStep === "generate" && <StepGenerate />}
        {currentStep === "select" && <StepSelect />}
        {currentStep === "adjust" && <StepAdjust />}
      </main>
    </div>
  )
}
