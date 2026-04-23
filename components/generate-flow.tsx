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
import Image from "next/image"

const STEP_LABELS = {
  upload: "Upload",
  placement: "Placement",
  variations: "Variations",
  generate: "Generate",
  select: "Download",
  download: "Download",
  adjust: "Download",
}

export function GenerateFlow() {
  const router = useRouter()
  const { currentStep, variationCount, goBack } = useFlowStore()

  // Build visible steps (merged select + download into one step)
  const allSteps = ["upload", "placement", "variations", "generate", "download"] as const
  const visibleSteps = allSteps

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
            <Image
              src="/Logo Kaykov Media_C.PNG"
              alt="Kaykov Media"
              width={80}
              height={28}
              className="object-contain brightness-0"
            />
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
      <main className="max-w-5xl mx-auto px-6 py-10">
        {currentStep === "upload" && <StepUpload />}
        {currentStep === "placement" && <StepPlacement />}
        {currentStep === "variations" && <StepVariations />}
        {currentStep === "generate" && <StepGenerate />}
        {currentStep === "download" && <StepSelect />}
        {currentStep === "select" && <StepSelect />}
        {currentStep === "adjust" && <StepAdjust />}
      </main>
    </div>
  )
}
