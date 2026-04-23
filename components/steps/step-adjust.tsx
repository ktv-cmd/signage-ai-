"use client"

import { useFlowStore } from "@/lib/flow-store"
import { Download } from "lucide-react"

export function StepAdjust() {
  const { generationResult, selectedCandidateId } = useFlowStore()

  if (!generationResult) return null

  const selectedCandidate =
    generationResult.candidates.find((c) => c.id === selectedCandidateId) ??
    generationResult.candidates[0]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review &amp; download</h2>
        <p className="text-gray-500 mt-1">
          Your selected design — download the mockup or go back to pick another.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden bg-gray-900">
        {selectedCandidate?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedCandidate.imageUrl}
            alt="Selected design"
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center">
            <span className="text-gray-400">Your design</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={16} />
          Download Mockup
        </button>
        <button
          type="button"
          onClick={() => useFlowStore.getState().goToStep("select")}
          className="px-5 py-3.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
        >
          Pick different
        </button>
      </div>
    </div>
  )
}
