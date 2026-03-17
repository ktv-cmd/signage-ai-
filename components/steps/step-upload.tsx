"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useFlowStore } from "@/lib/flow-store"
import { REFERENCE_STYLES } from "@/lib/references"
import { cn, createObjectUrl } from "@/lib/utils"
import { Upload, X, CheckCircle2, Image as ImageIcon } from "lucide-react"
import type { ReferenceStyle } from "@/types"

export function StepUpload() {
  const {
    storefrontPreviewUrl,
    brandAssetPreviewUrl,
    brandText,
    selectedReferences,
    setStorefront,
    setBrandAsset,
    setBrandText,
    clearBrandAsset,
    toggleReference,
    goNext,
  } = useFlowStore()

  const [brandMode, setBrandMode] = useState<"logo" | "text">(
    brandText ? "text" : "logo"
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items?.length) return

      const imageItem = Array.from(items).find((item) =>
        item.type.startsWith("image/")
      )
      if (!imageItem) return

      const pasted = imageItem.getAsFile()
      if (!pasted) return

      const extension = pasted.type.split("/")[1] || "png"
      const file = new File([pasted], `pasted-${Date.now()}.${extension}`, {
        type: pasted.type,
        lastModified: Date.now(),
      })

      event.preventDefault()

      // Prefer filling required storefront first; otherwise treat paste as logo while in logo mode.
      if (!storefrontPreviewUrl) {
        setStorefront(file, createObjectUrl(file))
        return
      }
      if (brandMode === "logo") {
        setBrandAsset(file, createObjectUrl(file))
      }
    }

    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [brandMode, setBrandAsset, setStorefront, storefrontPreviewUrl])

  const onDropStorefront = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) setStorefront(file, createObjectUrl(file))
    },
    [setStorefront]
  )

  const onDropBrand = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) setBrandAsset(file, createObjectUrl(file))
    },
    [setBrandAsset]
  )

  const storefrontDropzone = useDropzone({
    onDrop: onDropStorefront,
    accept: { "image/*": [] },
    maxFiles: 1,
  })

  const brandDropzone = useDropzone({
    onDrop: onDropBrand,
    accept: { "image/*": [] },
    maxFiles: 1,
    disabled: brandMode === "text",
  })

  const canProceed =
    storefrontPreviewUrl &&
    (brandAssetPreviewUrl || (brandMode === "text" && brandText?.trim())) &&
    selectedReferences.length > 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload your storefront</h2>
        <p className="text-gray-500 mt-1">
          Upload a photo and your brand, then choose a sign style.
        </p>
      </div>

      {/* Storefront upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Storefront photo <span className="text-red-500">*</span>
        </label>
        <div
          {...storefrontDropzone.getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors",
            storefrontDropzone.isDragActive
              ? "border-black bg-gray-50"
              : storefrontPreviewUrl
              ? "border-gray-200 bg-gray-50"
              : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
          )}
        >
          <input {...storefrontDropzone.getInputProps()} />
          {storefrontPreviewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storefrontPreviewUrl}
                alt="Storefront"
                className="w-full h-56 object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  useFlowStore.setState({ storefrontFile: undefined, storefrontPreviewUrl: undefined })
                }}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-600" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
                Click or drag to replace
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Upload size={20} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Drop your storefront photo here
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse · JPG, PNG · paste with Cmd/Ctrl+V</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brand: logo or text */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Your brand <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBrandMode("logo")}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors",
              brandMode === "logo"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            Upload logo
          </button>
          <button
            type="button"
            onClick={() => setBrandMode("text")}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors",
              brandMode === "text"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            Type name
          </button>
        </div>

        {brandMode === "logo" ? (
          <div
            {...brandDropzone.getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl cursor-pointer transition-colors",
              brandDropzone.isDragActive
                ? "border-black bg-gray-50"
                : brandAssetPreviewUrl
                ? "border-gray-200"
                : "border-gray-300 bg-white hover:border-gray-400"
            )}
          >
            <input {...brandDropzone.getInputProps()} />
            {brandAssetPreviewUrl ? (
              <div className="relative flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandAssetPreviewUrl}
                  alt="Logo"
                  className="h-12 w-auto object-contain rounded"
                />
                <span className="text-sm text-gray-600 flex-1">Logo uploaded</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearBrandAsset() }}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <ImageIcon size={18} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Upload your logo</p>
                  <p className="text-xs text-gray-400">PNG with transparent background works best · paste with Cmd/Ctrl+V</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={brandText ?? ""}
            onChange={(e) => setBrandText(e.target.value)}
            placeholder="e.g. Metropolitan Smiles"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400 transition-colors"
          />
        )}
      </div>

      {/* Reference styles */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Choose sign style <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            You can select more than one. Lighting is baked into each style.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REFERENCE_STYLES.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              selected={selectedReferences.some((r) => r.id === ref.id)}
              onToggle={() => toggleReference(ref)}
            />
          ))}
        </div>
      </div>

      {/* Next button */}
      <div className="pt-2">
        <button
          type="button"
          disabled={!canProceed}
          onClick={goNext}
          className={cn(
            "w-full py-3.5 rounded-xl text-sm font-semibold transition-colors",
            canProceed
              ? "bg-black text-white hover:bg-gray-800"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          Continue to Placement
        </button>
        {!canProceed && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Complete all required fields to continue
          </p>
        )}
      </div>
    </div>
  )
}

function ReferenceCard({
  reference,
  selected,
  onToggle,
}: {
  reference: ReferenceStyle
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative text-left rounded-xl border-2 overflow-hidden transition-all",
        selected
          ? "border-black shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      {/* Placeholder for reference image */}
      <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <span className="text-gray-400 text-xs">{reference.name}</span>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-gray-900">{reference.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{reference.description}</p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          <Tag label={reference.lightingType} />
          <Tag label={reference.materialFeel} />
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 size={18} className="text-black fill-white" />
        </div>
      )}
    </button>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
      {label}
    </span>
  )
}
