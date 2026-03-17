"use client"

import { useEffect, useRef, useState } from "react"
import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import type { Placement } from "@/types"

const DEFAULT_PLACEMENT: Placement = {
  centerX: 0.5,
  centerY: 0.22,
  width: 0.68,
  rotation: 0,
  facadeConfidence: 0.85,
}

export function StepPlacement() {
  const { storefrontPreviewUrl, placement, setPlacement, goNext } = useFlowStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<Placement>(placement ?? DEFAULT_PLACEMENT)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cx: 0, cy: 0 })

  // Auto-set placement on mount
  useEffect(() => {
    if (!placement) {
      setCurrent(DEFAULT_PLACEMENT)
      setPlacement(DEFAULT_PLACEMENT)
    }
  }, [placement, setPlacement])

  const getContainerRect = () => containerRef.current?.getBoundingClientRect()

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = getContainerRect()
    if (!rect) return
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cx: current.centerX,
      cy: current.centerY,
    })
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const rect = getContainerRect()
    if (!rect) return
    const dx = (e.clientX - dragStart.x) / rect.width
    const dy = (e.clientY - dragStart.y) / rect.height
    const updated = {
      ...current,
      centerX: Math.max(0.1, Math.min(0.9, dragStart.cx + dx)),
      centerY: Math.max(0.05, Math.min(0.6, dragStart.cy + dy)),
    }
    setCurrent(updated)
    setPlacement(updated)
  }

  const handleMouseUp = () => setIsDragging(false)

  const updateWidth = (delta: number) => {
    const updated = {
      ...current,
      width: Math.max(0.3, Math.min(0.95, current.width + delta)),
    }
    setCurrent(updated)
    setPlacement(updated)
  }

  const updateRotation = (delta: number) => {
    const updated = {
      ...current,
      rotation: Math.max(-15, Math.min(15, current.rotation + delta)),
    }
    setCurrent(updated)
    setPlacement(updated)
  }

  const resetPlacement = () => {
    setCurrent(DEFAULT_PLACEMENT)
    setPlacement(DEFAULT_PLACEMENT)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Position your sign</h2>
        <p className="text-gray-500 mt-1">
          We automatically placed your sign. Drag to adjust or resize it.
        </p>
      </div>

      {/* Preview canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden bg-gray-100 cursor-move select-none"
        style={{ aspectRatio: "16/9" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {storefrontPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={storefrontPreviewUrl}
            alt="Storefront"
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}

        {/* Sign placement box */}
        <div
          className={cn(
            "absolute border-2 border-white rounded flex items-center justify-center",
            isDragging ? "border-blue-400 shadow-lg" : "border-white/90 shadow-md"
          )}
          style={{
            left: `${(current.centerX - current.width / 2) * 100}%`,
            top: `${(current.centerY - 0.08) * 100}%`,
            width: `${current.width * 100}%`,
            height: "16%",
            transform: `rotate(${current.rotation}deg)`,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(2px)",
          }}
          onMouseDown={handleMouseDown}
        >
          <span className="text-white text-xs font-medium drop-shadow-sm opacity-80 pointer-events-none">
            Sign placement
          </span>
          {/* Corner resize handles */}
          <ResizeHandle side="left" onClick={() => updateWidth(-0.03)} />
          <ResizeHandle side="right" onClick={() => updateWidth(0.03)} />
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        <Control label="Narrower" onClick={() => updateWidth(-0.04)} />
        <Control label="Reset" onClick={resetPlacement} variant="secondary" />
        <Control label="Wider" onClick={() => updateWidth(0.04)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Control label="Rotate left" onClick={() => updateRotation(-2)} />
        <Control label="Rotate right" onClick={() => updateRotation(2)} />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-gray-400 bg-gray-100 rounded-lg p-3">
        <span>Width: {Math.round(current.width * 100)}%</span>
        <span>Position: {Math.round(current.centerX * 100)}%, {Math.round(current.centerY * 100)}%</span>
        {current.rotation !== 0 && <span>Rotation: {current.rotation.toFixed(1)}°</span>}
      </div>

      <button
        type="button"
        onClick={goNext}
        className="w-full bg-black text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
      >
        Confirm Placement
      </button>
    </div>
  )
}

function ResizeHandle({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-white/80 rounded flex items-center justify-center hover:bg-white transition-colors",
        side === "left" ? "-left-2" : "-right-2"
      )}
    >
      <span className="text-gray-600 text-xs">{side === "left" ? "‹" : "›"}</span>
    </button>
  )
}

function Control({
  label,
  onClick,
  variant = "default",
}: {
  label: string
  onClick: () => void
  variant?: "default" | "secondary"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "py-2.5 rounded-lg text-sm font-medium transition-colors",
        variant === "secondary"
          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
          : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      {label}
    </button>
  )
}
