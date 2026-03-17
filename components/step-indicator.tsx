"use client"

import { cn } from "@/lib/utils"
import type { FlowStep } from "@/types"

const STEP_ORDER: FlowStep[] = ["upload", "placement", "variations", "generate", "select", "adjust"]

interface Props {
  steps: { id: FlowStep; label: string }[]
  currentStep: FlowStep
}

export function StepIndicator({ steps, currentStep }: Props) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isDone = i < currentIndex
        const isActive = i === currentIndex

        return (
          <div key={step.id} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                  isDone && "bg-black text-white",
                  isActive && "bg-black text-white ring-2 ring-black ring-offset-2",
                  !isDone && !isActive && "bg-gray-200 text-gray-500"
                )}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium truncate hidden sm:block",
                  isActive && "text-gray-900",
                  isDone && "text-gray-400",
                  !isDone && !isActive && "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-1",
                  i < currentIndex ? "bg-black" : "bg-gray-200"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
