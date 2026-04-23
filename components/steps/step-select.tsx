"use client"

import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import { Download, CheckCircle2 } from "lucide-react"
import { useState } from "react"

export function StepSelect() {
  const { generationResult } = useFlowStore()
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())

  if (!generationResult) return null

  const { candidates } = generationResult

  const downloadImage = async (candidate: typeof candidates[0]) => {
    if (!candidate.imageUrl) return
    
    try {
      // Download image
      const response = await fetch(candidate.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sign-mockup-${candidate.id}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      // Mark as downloaded
      setDownloaded(new Set([...downloaded, candidate.id]))
    } catch (error) {
      console.error("Download failed:", error)
    }
  }

  const downloadAll = async () => {
    for (const candidate of candidates) {
      if (!candidate.imageUrl) continue
      await downloadImage(candidate)
      // Small delay between downloads
      if (candidates.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-gray-900">Your Generated Designs</h2>
        <p className="text-gray-600 text-xl">
          {candidates.length} design{candidates.length > 1 ? "s" : ""} ready
        </p>
      </div>

      {/* Image Grid - VERY LARGE, NO TEXT BELOW */}
      <div className={cn(
        "grid gap-8",
        candidates.length === 1 ? "grid-cols-1" :
        candidates.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
        candidates.length === 3 ? "grid-cols-1 lg:grid-cols-3" :
        "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      )}>
        {candidates.map((candidate, i) => {
          const isDownloaded = downloaded.has(candidate.id)
          return (
            <div
              key={candidate.id}
              className="relative group"
            >
              {/* Generated image - MAXIMUM SIZE */}
              <div className="bg-gray-900 relative rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all">
                {candidate.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.imageUrl}
                    alt={`Design ${i + 1}`}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center">
                    <span className="text-gray-400 text-sm">Design {i + 1}</span>
                  </div>
                )}

                {/* Downloaded checkmark */}
                {isDownloaded && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className="bg-green-500 rounded-full p-3 shadow-lg">
                      <CheckCircle2 size={32} className="text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Download Button - PROMINENT */}
      <div className="pt-6">
        <button
          type="button"
          onClick={downloadAll}
          className="w-full py-5 rounded-2xl text-xl font-bold transition-all bg-black text-white hover:bg-gray-800 hover:shadow-2xl flex items-center justify-center gap-3"
        >
          <Download size={28} />
          Download {candidates.length === 1 ? "Design" : `All ${candidates.length} Designs`}
        </button>
      </div>

      {/* Downloaded status */}
      {downloaded.size > 0 && (
        <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-5 text-center">
          <p className="text-lg text-green-800 font-semibold">
            ✓ {downloaded.size} of {candidates.length} design{candidates.length > 1 ? "s" : ""} downloaded successfully
          </p>
        </div>
      )}
    </div>
  )
}

function SpecTag({ label }: { label: string }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium capitalize">
      {label}
    </span>
  )
}
