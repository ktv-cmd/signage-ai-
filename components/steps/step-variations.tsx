"use client"

import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import type { VariationCount } from "@/types"

const OPTIONS: { count: VariationCount; label: string; sublabel: string; recommended?: boolean }[] = [
  {
    count: 1,
    label: "1 design",
    sublabel: "One focused result based on your selected style",
  },
  {
    count: 3,
    label: "3 designs",
    sublabel: "Three style-consistent variations — subtle depth, material, and edge differences",
    recommended: true,
  },
  {
    count: 6,
    label: "6 designs",
    sublabel: "Six curated options for broader exploration — all anchored to your chosen style",
  },
]

export function StepVariations() {
  const { variationCount, setVariationCount, goNext } = useFlowStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">How many design options?</h2>
        <p className="text-gray-500 mt-1">
          All variations stay true to your chosen style — just different details.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(({ count, label, sublabel, recommended }) => (
          <button
            key={count}
            type="button"
            onClick={() => setVariationCount(count)}
            className={cn(
              "w-full text-left p-4 rounded-xl border-2 transition-all relative",
              variationCount === count
                ? "border-black bg-gray-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                    variationCount === count
                      ? "border-black"
                      : "border-gray-300"
                  )}
                >
                  {variationCount === count && (
                    <div className="w-2.5 h-2.5 rounded-full bg-black" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{sublabel}</p>
                </div>
              </div>
              {recommended && (
                <span className="shrink-0 text-xs bg-black text-white px-2 py-0.5 rounded-full font-medium">
                  Recommended
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* What varies */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          What changes between variations
        </p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
            Letter depth (shallow → deep)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
            Edge profile (sharp, beveled, rounded)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
            Mounting style (flush, stand-off, raceway)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
            Backing plate on / off
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
            Subtle material feel differences
          </li>
        </ul>
        <p className="text-xs text-gray-400 pt-1">
          Lighting is fixed by your chosen reference style.
        </p>
      </div>

      <button
        type="button"
        disabled={!variationCount}
        onClick={goNext}
        className={cn(
          "w-full py-3.5 rounded-xl text-sm font-semibold transition-colors",
          variationCount
            ? "bg-black text-white hover:bg-gray-800"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        Continue
      </button>
    </div>
  )
}
