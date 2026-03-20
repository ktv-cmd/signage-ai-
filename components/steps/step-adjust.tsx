"use client"

import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import { Sun, Moon, Download } from "lucide-react"

const LIGHT_COLORS = [
  { label: "Warm white", hex: "#FFF5E1" },
  { label: "Cool white", hex: "#F0F8FF" },
  { label: "Pure white", hex: "#FFFFFF" },
  { label: "Amber", hex: "#FFB347" },
  { label: "Blue", hex: "#87CEEB" },
  { label: "Red", hex: "#FF6B6B" },
]

const FACE_COLORS = [
  { label: "Brushed silver", hex: "#C0C0C0" },
  { label: "Matte black", hex: "#1A1A1A" },
  { label: "Gold", hex: "#D4AF37" },
  { label: "White", hex: "#F5F5F5" },
  { label: "Bronze", hex: "#8C6B3F" },
  { label: "Custom", hex: "custom" },
]

export function StepAdjust() {
  const {
    generationResult,
    selectedCandidateId,
    placement,
    adjustments,
    setAdjustments,
  } = useFlowStore()

  if (!adjustments || !generationResult) return null

  const selectedCandidate = generationResult.candidates.find(
    (c) => c.id === selectedCandidateId
  ) ?? generationResult.candidates[0]

  const allowedLightModes = generationResult.compatibility.allowedLightModes

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Adjust your design</h2>
        <p className="text-gray-500 mt-1">
          Fine-tune colors, lighting, and preview day vs. night.
        </p>
      </div>

      {/* Main preview */}
      <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video relative">
        {selectedCandidate?.imageUrl ? (
          <>
            {/* Base image stays untouched */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedCandidate.imageUrl}
              alt="Selected design"
              className="w-full h-full object-cover"
            />

            {/* Full-image day/night filter layer */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedCandidate.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                filter: buildPreviewFilter(adjustments),
              }}
            />

            {/* Sign-only color tint */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `${adjustments.faceColor}${adjustments.timeOfDay === "night" ? "66" : "4D"}`,
                mixBlendMode: "multiply",
                clipPath: buildPlacementClipPath(placement),
              }}
            />

            {/* Sign-only detail tint */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `${adjustments.detailColor}33`,
                mixBlendMode: "soft-light",
                clipPath: buildPlacementClipPath(placement),
              }}
            />

            {/* Full-image night glow */}
            {adjustments.timeOfDay === "night" && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 80% 50% at 50% 30%, ${adjustments.lightColor}22 0%, transparent 70%)`,
                }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-400">Your design</span>
          </div>
        )}

        {/* Day/Night toggle */}
        <div className="absolute bottom-3 right-3 flex gap-1 bg-black/60 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setAdjustments({ timeOfDay: "day" })}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
              adjustments.timeOfDay === "day"
                ? "bg-white text-gray-900"
                : "text-white/70 hover:text-white"
            )}
          >
            <Sun size={12} />
            Day
          </button>
          <button
            type="button"
            onClick={() => setAdjustments({ timeOfDay: "night" })}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
              adjustments.timeOfDay === "night"
                ? "bg-white text-gray-900"
                : "text-white/70 hover:text-white"
            )}
          >
            <Moon size={12} />
            Night
          </button>
        </div>
      </div>

      {/* Adjustment panels */}
      <div className="space-y-5">
        {/* Face color */}
        <Panel title="Face color">
          <div className="flex gap-2 flex-wrap">
            {FACE_COLORS.map(({ label, hex }) =>
              hex === "custom" ? (
                <label key={hex} className="cursor-pointer" title="Custom color">
                  <input
                    type="color"
                    value={adjustments.faceColor}
                    onChange={(e) => setAdjustments({ faceColor: e.target.value })}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs overflow-hidden",
                      "border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                    )}
                    style={{
                      background: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)",
                    }}
                  />
                </label>
              ) : (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => setAdjustments({ faceColor: hex })}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    adjustments.faceColor === hex
                      ? "border-black scale-110"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                  style={{ background: hex }}
                />
              )
            )}
          </div>
        </Panel>

        {/* Light color */}
        <Panel title="Light color">
          <div className="flex gap-2 flex-wrap">
            {LIGHT_COLORS.map(({ label, hex }) => (
              <button
                key={hex}
                type="button"
                title={label}
                onClick={() => setAdjustments({ lightColor: hex })}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  adjustments.lightColor === hex
                    ? "border-black scale-110"
                    : "border-gray-200 hover:border-gray-400"
                )}
                style={{ background: hex, boxShadow: `0 0 6px ${hex}60` }}
              />
            ))}
          </div>
        </Panel>

        {/* Light intensity */}
        <Panel title={`Light intensity — ${adjustments.lightIntensity}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={adjustments.lightIntensity}
            onChange={(e) => setAdjustments({ lightIntensity: Number(e.target.value) })}
            className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black"
          />
        </Panel>

        {/* Lighting mode (only if compatible options exist) */}
        {allowedLightModes.length > 1 && (
          <Panel title="Lighting direction">
            <div className="flex gap-2">
              {allowedLightModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAdjustments({ lightingMode: mode })}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors capitalize",
                    adjustments.lightingMode === mode
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {mode === "both" ? "Front + Back" : `${mode} lit`}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* Actions */}
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {children}
    </div>
  )
}


function buildPreviewFilter(adjustments: {
  faceColor: string
  detailColor: string
  lightIntensity: number
  timeOfDay: "day" | "night"
}): string {
  const hueRotate = getHueRotateFromHex(adjustments.faceColor)
  const detailLuma = getLuminance(adjustments.detailColor)
  const intensity = adjustments.lightIntensity / 100

  const brightness = adjustments.timeOfDay === "night" ? 0.5 + intensity * 0.2 : 0.9 + intensity * 0.35
  const contrast = adjustments.timeOfDay === "night" ? 1.18 : 1.05 + (1 - detailLuma) * 0.25
  const saturation = 1.15 + intensity * 0.9

  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(0.28) hue-rotate(${hueRotate}deg)`
}

function getHueRotateFromHex(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const { h } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  // Map selected face color hue onto a neutral metallic baseline (~35deg)
  return Math.round(h - 35)
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "")
  const value = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null

  const int = Number.parseInt(value, 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === rr) h = ((gg - bb) / delta) % 6
    else if (max === gg) h = (bb - rr) / delta + 2
    else h = (rr - gg) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s, l }
}


function buildPlacementClipPath(
  placement?: { centerX: number; centerY: number; width: number }
): string {
  if (!placement) {
    // Fallback if placement is unavailable
    return "inset(32% 18% 50% 18%)"
  }

  const signHeight = 0.16
  const left = Math.max(0, placement.centerX - placement.width / 2)
  const right = Math.min(1, placement.centerX + placement.width / 2)
  const top = Math.max(0, placement.centerY - signHeight / 2)
  const bottom = Math.min(1, placement.centerY + signHeight / 2)

  return `polygon(${left * 100}% ${top * 100}%, ${right * 100}% ${top * 100}%, ${right * 100}% ${bottom * 100}%, ${left * 100}% ${bottom * 100}%)`
}
