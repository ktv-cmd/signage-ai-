"use client"

import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"

export function StepSelect() {
  const { generationResult, selectedCandidateId, setSelectedCandidate, goNext } =
    useFlowStore()

  if (!generationResult) return null

  const { candidates } = generationResult

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Choose your favourite</h2>
        <p className="text-gray-500 mt-1">
          {candidates.length} design{candidates.length > 1 ? "s" : ""} generated. Pick the one
          you'd like to refine.
        </p>
      </div>

      <div className={cn(
        "grid gap-4",
        candidates.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"
      )}>
        {candidates.map((candidate, i) => {
          const isSelected = selectedCandidateId === candidate.id
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedCandidate(candidate.id)}
              className={cn(
                "relative text-left rounded-xl overflow-hidden border-2 transition-all",
                isSelected ? "border-black shadow-md" : "border-gray-200 hover:border-gray-300"
              )}
            >
              {/* Generated image */}
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative">
                {candidate.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.imageUrl}
                    alt={`Design option ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Option {i + 1}</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 size={20} className="text-black fill-white" />
                  </div>
                )}
              </div>

              {/* Spec summary */}
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-semibold text-gray-800">Option {i + 1}</p>
                <div className="flex flex-wrap gap-1">
                  <SpecTag label={candidate.spec.depthProfile} />
                  <SpecTag label={candidate.spec.edgeProfile} />
                  <SpecTag label={candidate.spec.mountingStyle} />
                  {candidate.spec.hasBackingPlate && <SpecTag label="backing plate" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        disabled={!selectedCandidateId}
        onClick={goNext}
        className={cn(
          "w-full py-3.5 rounded-xl text-sm font-semibold transition-colors",
          selectedCandidateId
            ? "bg-black text-white hover:bg-gray-800"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        Refine Selected Design
      </button>
    </div>
  )
}

function SpecTag({ label }: { label: string }) {
  return (
    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium capitalize">
      {label}
    </span>
  )
}
