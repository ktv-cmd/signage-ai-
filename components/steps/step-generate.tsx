"use client"

import { useEffect, useState } from "react"
import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import { Sparkles, Loader2, ChevronDown, ChevronUp, Eye } from "lucide-react"
import { LeadCaptureModal } from "@/components/lead-capture-modal"

export function StepGenerate() {
  const {
    storefrontFile,
    storefrontPreviewUrl,
    brandAssetFile,
    brandText,
    textStyling,
    selectedReferences,
    placement,
    placementBrushFile,
    variationCount,
    setSelectedProvider,
    setGenerationResult,
    setLeadId,
    leadId,
    goNext,
  } = useFlowStore()

  const [status, setStatus] = useState<"idle" | "uploading" | "generating" | "done" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showPromptPreview, setShowPromptPreview] = useState(false)
  const [previewPrompt, setPreviewPrompt] = useState<string>("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Auto-set Gemini as default and only provider
  useEffect(() => {
    setSelectedProvider("gemini-2.5")
  }, [setSelectedProvider])

  // Build prompt preview locally (client-side)
  const buildPromptPreview = () => {
    if (!variationCount || selectedReferences.length !== 1) return
    
    setLoadingPreview(true)
    
    try {
      const reference = selectedReferences[0]
      const resolvedBrandText = brandText ?? "Business"
      const brandMode = brandAssetFile && brandText ? "logo-and-text"
        : brandAssetFile ? "logo-only"
        : "text-only"
      
      const isAwning = reference.id === "awning"
      const isLightBox = reference.id === "light-box"
      
      // Content description
      const contentDesc = brandMode === "logo-only"
        ? "the logo from Image 2"
        : brandMode === "text-only"
        ? `the text '${resolvedBrandText}'`
        : `the logo from Image 2 alongside the text '${resolvedBrandText}'`
      
      // Sign type
      const signType = isAwning ? "fabric awning" : isLightBox ? "illuminated cabinet" : "channel letter"
      
      // Font description
      const fontDesc = textStyling?.fontStyle === "modern-sans" ? " with a modern, clean sans-serif font"
        : textStyling?.fontStyle === "classic-serif" ? " with an elegant, classic serif font"
        : textStyling?.fontStyle === "bold-condensed" ? " with a bold, condensed industrial font"
        : " with a professional, modern font"
      
      // Color description
      const colorDesc = brandMode === "logo-only"
        ? "The colors must match exactly the logo provided in Image 2."
        : textStyling?.color
        ? `The letters should be ${textStyling.color}.`
        : "The letters should complement the building's color palette."
      
      // Lighting description
      const lightDesc = isAwning ? "natural daylight illumination only"
        : reference.lightingType === "front" ? "front-lit illumination (glowing letter faces)"
        : reference.lightingType === "back" ? "back-lit illumination (halo glow behind the letters)"
        : reference.lightingType === "both" ? "front and back-lit illumination"
        : "no artificial illumination (natural shadows only)"
      
      // Build the clean prompt preview
      let prompt = ""
      
      if (isAwning) {
        // Awning-specific color rules
        let awningColorDesc = ""
        if (brandMode === "text-only") {
          const awningColor = textStyling?.color || "a professional color"
          awningColorDesc = `AWNING COLOR: ${awningColor}. TEXT COLOR: White or cream (neutral, high contrast).`
        } else if (brandMode === "logo-only") {
          awningColorDesc = `AWNING COLOR: Matches/complements the logo colors. LOGO: Exact original colors.`
        } else {
          awningColorDesc = `AWNING COLOR: Matches/complements the logo. LOGO: Original colors. TEXT: White/cream.`
        }
        
        prompt = [
          `Generate a photorealistic architectural photo of the storefront.`,
          `Inside the area marked by the yellow highlight, place a new, professional fabric awning that clearly displays ${contentDesc}.`,
          ``,
          `The awning must be made of heavyweight canvas fabric with natural draping and visible texture.`,
          `The graphics should appear screen-printed or vinyl-applied onto the fabric surface.`,
          ``,
          awningColorDesc,
          ``,
          `The awning must be properly anchored to the building with a visible metal frame—do not let it float.`,
          `Use natural daylight only—no artificial glow.`,
          `Completely replace the yellow highlighted area with this new awning.`,
        ].join(" ")
      } else if (isLightBox) {
        prompt = [
          `Generate a photorealistic architectural photo of the storefront.`,
          `Inside the area marked by the yellow highlight, place a new, high-end illuminated light box sign that clearly displays ${contentDesc}.`,
          ``,
          `The sign must be a sleek aluminum cabinet with a translucent acrylic face panel.`,
          colorDesc,
          `Internal LED illumination creates an even, soft glow.`,
          ``,
          `Ensure the sign is physically mounted to the wall with visible brackets—do not let it float.`,
          `Completely replace the yellow highlighted area with this new signage.`,
        ].join(" ")
      } else {
        prompt = [
          `Generate a photorealistic architectural photo of the storefront.`,
          `Inside the area marked by the yellow highlight, place a new, high-end ${signType} sign that clearly reads ${contentDesc}.`,
          ``,
          `The sign must be dimensional, 3D channel letters${fontDesc}.`,
          colorDesc,
          `The sign must have ${lightDesc}.`,
          ``,
          `Ensure the new signage is physically mounted to the wall with visible brackets—do not let it float.`,
          `The text must be sharp, legible, and integrated into the building's facade.`,
          `Completely replace the yellow highlighted area with this new signage.`,
        ].join(" ")
      }
      
      // Add images info
      const imagesInfo = brandAssetFile 
        ? "\n\n---\nImages sent: (1) Storefront with golden zone, (2) Your logo"
        : "\n\n---\nImages sent: (1) Storefront with golden zone"
      
      setPreviewPrompt(prompt + imagesInfo)
    } catch {
      setPreviewPrompt("Could not build preview")
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleTogglePromptPreview = () => {
    const newState = !showPromptPreview
    setShowPromptPreview(newState)
    if (newState && !previewPrompt) {
      buildPromptPreview()
    }
  }

  const handleGenerate = async (capturedLeadId?: string | null) => {
    if (
      !storefrontFile ||
      !placement ||
      !placementBrushFile ||
      !variationCount ||
      selectedReferences.length !== 1
    ) {
      return
    }

    setStatus("uploading")
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append("storefront", storefrontFile)
      if (brandAssetFile) formData.append("brandAsset", brandAssetFile)
      if (brandText) formData.append("brandText", brandText)
      if (textStyling) formData.append("textStyling", JSON.stringify(textStyling))
      formData.append("references", JSON.stringify(selectedReferences))
      formData.append("placement", JSON.stringify(placement))
      if (placementBrushFile) formData.append("placementBrush", placementBrushFile)
      formData.append("variationCount", String(variationCount))
      formData.append("provider", "gemini-2.5")

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

      // Save generated image to Supabase + send email notification
      const resolvedLeadId = capturedLeadId ?? leadId
      const firstImage = result.candidates?.[0]?.imageUrl
      if (resolvedLeadId && firstImage) {
        fetch("/api/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: resolvedLeadId, generatedImageUrl: firstImage }),
        }).catch(() => {})
      }

      setTimeout(() => goNext(), 600)
    } catch (err) {
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const handleLeadConfirm = (capturedLeadId: string | null) => {
    setShowLeadModal(false)
    if (capturedLeadId) setLeadId(capturedLeadId)
    handleGenerate(capturedLeadId)
  }

  // Silent re-submission for returning users — saves new session to Supabase
  // without asking them to fill the form again.
  const submitSilently = async (): Promise<string | null> => {
    try {
      const stored = localStorage.getItem("signai_lead")
      if (!stored) return null
      const lead = JSON.parse(stored)

      const fd = new FormData()
      fd.append("name",    lead.name    ?? "")
      fd.append("email",   lead.email   ?? "")
      fd.append("phone",   lead.phone   ?? "")
      fd.append("company", lead.company ?? "")
      if (storefrontFile) fd.append("storefront", storefrontFile)
      if (brandAssetFile) fd.append("logo",       brandAssetFile)

      const res  = await fetch("/api/leads", { method: "POST", body: fd })
      const json = await res.json().catch(() => ({}))
      return json.id ?? null
    } catch {
      return null
    }
  }

  const handleGenerateClick = async () => {
    const stored = localStorage.getItem("signai_lead")
    if (stored) {
      // Returning user — skip modal, submit silently, generate immediately
      const newLeadId = await submitSilently()
      if (newLeadId) setLeadId(newLeadId)
      handleGenerate(newLeadId)
    } else {
      // First time — show the form
      setShowLeadModal(true)
    }
  }

  const isLoading = status === "uploading" || status === "generating"

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ready to generate</h2>
        <p className="text-gray-500 mt-1">
          Review your setup and generate your sign mockup.
        </p>
      </div>

      {/* ── Summary card ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <SummaryRow label="Storefront" value={storefrontPreviewUrl ? "Photo uploaded" : "—"} imageUrl={storefrontPreviewUrl} />
        <SummaryRow label="Brand" value={brandText ?? (brandAssetFile ? "Logo uploaded" : "—")} />
        <SummaryRow
          label="Style references"
          value={selectedReferences.map((r) => r.name).join(", ") || "—"}
        />
        <SummaryRow
          label="Variations"
          value={variationCount ? `${variationCount} design${variationCount > 1 ? "s" : ""}` : "—"}
        />
      </div>

      {/* ── Prompt Preview ─────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={handleTogglePromptPreview}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Preview AI Prompt</span>
          </div>
          {showPromptPreview ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
        
        {showPromptPreview && (
          <div className="p-4 bg-white border-t border-gray-100">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Building prompt...</span>
              </div>
            ) : previewPrompt ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Prompt being sent to AI:</p>
                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {previewPrompt}
                  </pre>
                </div>
                <p className="text-xs text-gray-400">
                  This prompt instructs the AI how to generate your sign mockup.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Click to load prompt preview
              </p>
            )}
          </div>
        )}
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
        disabled={isLoading || status === "done"}
        onClick={handleGenerateClick}
        className={cn(
          "w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
          isLoading || status === "done"
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

      {showLeadModal && (
        <LeadCaptureModal
          storefrontFile={storefrontFile}
          logoFile={brandAssetFile}
          onConfirm={handleLeadConfirm}
          onClose={() => setShowLeadModal(false)}
        />
      )}
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
