"use client"

import { useEffect, useState } from "react"
import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react"
import type { ProviderInfo } from "@/app/api/providers/route"

export function StepGenerate() {
  const {
    storefrontFile,
    storefrontPreviewUrl,
    brandAssetFile,
    brandText,
    selectedReferences,
    placement,
    variationCount,
    selectedProvider,
    setSelectedProvider,
    setGenerationResult,
    goNext,
  } = useFlowStore()

  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [status, setStatus] = useState<"idle" | "uploading" | "generating" | "done" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [progress, setProgress] = useState(0)

  // Load available providers once on mount
  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((list: ProviderInfo[]) => {
        setProviders(list)
        // Auto-select the first available provider if none selected
        if (!selectedProvider) {
          const first = list.find((p) => p.available)
          if (first) setSelectedProvider(first.id)
        }
      })
      .catch(() => {})
  }, [selectedProvider, setSelectedProvider])

  const handleGenerate = async () => {
    if (!storefrontFile || !placement || !variationCount || selectedReferences.length === 0) return

    setStatus("uploading")
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append("storefront", storefrontFile)
      if (brandAssetFile) formData.append("brandAsset", brandAssetFile)
      if (brandText) formData.append("brandText", brandText)
      formData.append("references", JSON.stringify(selectedReferences))
      formData.append("placement", JSON.stringify(placement))
      formData.append("variationCount", String(variationCount))
      if (selectedProvider) formData.append("provider", selectedProvider)

      setStatus("generating")
      setProgress(30)

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      })

      setProgress(90)

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Generation failed" }))
        throw new Error(err.error ?? "Generation failed")
      }

      const result = await response.json()
      setProgress(100)
      setStatus("done")
      setGenerationResult(result)

      setTimeout(() => goNext(), 600)
    } catch (err) {
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const isLoading = status === "uploading" || status === "generating"

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ready to generate</h2>
        <p className="text-gray-500 mt-1">
          Choose your AI model, review your setup, then generate.
        </p>
      </div>

      {/* ── Model selector ─────────────────────────────────────────────────── */}
      {providers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">AI Model</p>
          <div className="grid gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!p.available || isLoading}
                onClick={() => p.available && setSelectedProvider(p.id)}
                className={cn(
                  "relative w-full text-left rounded-xl border-2 px-4 py-3 transition-all",
                  !p.available && "opacity-40 cursor-not-allowed",
                  p.available && selectedProvider === p.id
                    ? "border-black bg-gray-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                      {p.badge && (
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          p.id === "fal"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {p.badge}
                        </span>
                      )}
                      {!p.available && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          No API key
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                  {selectedProvider === p.id && p.available && (
                    <CheckCircle2 size={18} className="text-black shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary card ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <SummaryRow label="Storefront" value={storefrontPreviewUrl ? "Photo uploaded" : "—"} imageUrl={storefrontPreviewUrl} />
        <SummaryRow label="Brand" value={brandText ?? (brandAssetFile ? "Logo uploaded" : "—")} />
        <SummaryRow
          label="Style references"
          value={selectedReferences.map((r) => r.name).join(", ") || "—"}
        />
        <SummaryRow
          label="Placement"
          value={
            placement
              ? `Center ${Math.round(placement.centerX * 100)}%, width ${Math.round(placement.width * 100)}%`
              : "—"
          }
        />
        <SummaryRow
          label="Variations"
          value={variationCount ? `${variationCount} design${variationCount > 1 ? "s" : ""}` : "—"}
        />
      </div>

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            {status === "uploading" ? "Uploading your images…" : "Generating your sign design…"}
          </p>
        </div>
      )}

      {status === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-green-700">Generation complete! Loading results…</p>
        </div>
      )}

      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">Error: {errorMessage}</p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="text-xs text-red-500 underline mt-1"
          >
            Try again
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={isLoading || status === "done" || !selectedProvider}
        onClick={handleGenerate}
        className={cn(
          "w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
          isLoading || status === "done" || !selectedProvider
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {status === "uploading" ? "Uploading…" : "Generating…"}
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Generate My Sign{variationCount && variationCount > 1 ? "s" : ""}
          </>
        )}
      </button>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  imageUrl,
}: {
  label: string
  value: string
  imageUrl?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-xs font-medium text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-8 h-8 object-cover rounded" />
        )}
        <span className="text-sm text-gray-700 truncate">{value}</span>
      </div>
    </div>
  )
}
