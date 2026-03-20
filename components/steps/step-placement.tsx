"use client"

import { useEffect, useRef, useState } from "react"
import { useFlowStore } from "@/lib/flow-store"
import { cn } from "@/lib/utils"
import type { Placement } from "@/types"

const DEFAULT_PLACEMENT: Placement = {
  centerX: 0.5,
  centerY: 0.22,
  width: 0.68,
  height: 0.14,
  rotation: 0,
  facadeConfidence: 0.85,
}

// Which part of the box is being dragged
type DragHandle = "move" | "left" | "right" | "top" | "bottom" | "tl" | "tr" | "bl" | "br" | "rotate"

interface DragState {
  handle: DragHandle
  startX: number        // pointer start px
  startY: number        // pointer start px
  cx: number            // box centerX at drag start
  cy: number            // box centerY at drag start
  w: number             // box width at drag start
  h: number             // box height at drag start
  startAngle: number    // angle (deg) from box center to pointer at drag start
  initialRotation: number // rotation (deg) at drag start
}

export function StepPlacement() {
  const { storefrontPreviewUrl, placement, setPlacement, goNext } = useFlowStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const [current, setCurrent] = useState<Placement>(placement ?? DEFAULT_PLACEMENT)
  // Use a ref so the pointermove closure always has the latest drag state
  const drag = useRef<DragState | null>(null)
  const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null)

  useEffect(() => {
    if (!placement) {
      setCurrent(DEFAULT_PLACEMENT)
      setPlacement(DEFAULT_PLACEMENT)
    }
  }, [placement, setPlacement])

  const commit = (patch: Partial<Placement>) => {
    const next = { ...current, ...patch }
    setCurrent(next)
    setPlacement(next)
  }

  // ── Unified pointer helpers ───────────────────────────────────────────────
  const getPointer = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if ("touches" in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
  }

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    handle: DragHandle
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const p = getPointer(e)
    const rect = containerRef.current?.getBoundingClientRect()
    // Compute angle from box center to pointer (for rotate handle)
    let startAngle = 0
    if (rect) {
      const bcx = rect.left + current.centerX * rect.width
      const bcy = rect.top  + current.centerY * rect.height
      startAngle = Math.atan2(p.y - bcy, p.x - bcx) * (180 / Math.PI)
    }
    drag.current = {
      handle,
      startX: p.x,
      startY: p.y,
      cx: current.centerX,
      cy: current.centerY,
      w: current.width,
      h: current.height ?? 0.14,
      startAngle,
      initialRotation: current.rotation ?? 0,
    }
    setActiveHandle(handle)
  }

  // ── Move + resize math ────────────────────────────────────────────────────
  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const p = getPointer(e)
    const dx = (p.x - drag.current.startX) / rect.width
    const dy = (p.y - drag.current.startY) / rect.height
    const { handle, cx, cy, w, h } = drag.current

    if (handle === "move") {
      commit({
        centerX: Math.max(0.05, Math.min(0.95, cx + dx)),
        centerY: Math.max(0.03, Math.min(0.95, cy + dy)),
      })
      return
    }

    if (handle === "rotate") {
      const bcx = rect.left + drag.current.cx * rect.width
      const bcy = rect.top  + drag.current.cy * rect.height
      const currentAngle = Math.atan2(p.y - bcy, p.x - bcx) * (180 / Math.PI)
      const newRotation = drag.current.initialRotation + (currentAngle - drag.current.startAngle)
      commit({ rotation: Math.max(-30, Math.min(30, newRotation)) })
      return
    }

    // Fixed edges before resize
    const origLeft   = cx - w / 2
    const origRight  = cx + w / 2
    const origTop    = cy - h / 2
    const origBottom = cy + h / 2

    const MIN_W = 0.12
    const MIN_H = 0.05

    let newLeft   = origLeft
    let newRight  = origRight
    let newTop    = origTop
    let newBottom = origBottom

    if (handle === "left"  || handle === "tl" || handle === "bl") {
      newLeft = Math.min(origRight - MIN_W, origLeft + dx)
    }
    if (handle === "right" || handle === "tr" || handle === "br") {
      newRight = Math.max(origLeft + MIN_W, origRight + dx)
    }
    if (handle === "top"   || handle === "tl" || handle === "tr") {
      newTop = Math.min(origBottom - MIN_H, origTop + dy)
    }
    if (handle === "bottom"|| handle === "bl" || handle === "br") {
      newBottom = Math.max(origTop + MIN_H, origBottom + dy)
    }

    commit({
      centerX: (newLeft + newRight) / 2,
      centerY: (newTop + newBottom) / 2,
      width:   newRight - newLeft,
      height:  newBottom - newTop,
    })
  }

  const onPointerUp = () => {
    drag.current = null
    setActiveHandle(null)
  }

  // ── Box geometry (% of container) ────────────────────────────────────────
  const h = current.height ?? 0.14
  const boxLeft   = (current.centerX - current.width / 2) * 100
  const boxTop    = (current.centerY - h / 2) * 100
  const boxWidth  = current.width * 100
  const boxHeight = h * 100

  const isResizing = activeHandle !== null && activeHandle !== "move"

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Position your sign</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Drag the centre to move · edges or corners to resize · circle above to rotate.
        </p>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-visible bg-gray-900 select-none touch-none"
        style={{ aspectRatio: "16/9" }}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        onTouchCancel={onPointerUp}
      >
        {/* Clip the photo inside rounded corners */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          {storefrontPreviewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storefrontPreviewUrl}
              alt="Storefront"
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
          {/* Dim overlay */}
          <div className="absolute inset-0 bg-black/35 pointer-events-none" />
        </div>

        {/* Sign placement box — positioned absolutely over the canvas */}
        <div
          className="absolute"
          style={{
            left: `${boxLeft}%`,
            top: `${boxTop}%`,
            width: `${boxWidth}%`,
            height: `${boxHeight}%`,
            transform: `rotate(${current.rotation ?? 0}deg)`,
          }}
        >
          {/* Box face — drag to move */}
          <div
            className={cn(
              "absolute inset-0 cursor-grab active:cursor-grabbing",
              activeHandle === "move" && "ring-2 ring-blue-400 ring-inset"
            )}
            style={{
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(1px)",
              border: "2px dashed rgba(255,255,255,0.85)",
              borderRadius: "4px",
              boxShadow: isResizing || activeHandle === "move"
                ? "0 0 0 1px rgba(96,165,250,0.6), 0 8px 32px rgba(0,0,0,0.5)"
                : "0 4px 16px rgba(0,0,0,0.3)",
            }}
            onMouseDown={(e) => startDrag(e, "move")}
            onTouchStart={(e) => startDrag(e, "move")}
          >
            <span className="absolute inset-0 flex items-center justify-center text-white/80 text-[10px] sm:text-xs font-semibold tracking-widest pointer-events-none uppercase">
              Sign Area
            </span>
          </div>

          {/* ── Edge handles (resize) ──────────────────────────────────────── */}
          {/* Left */}
          <Handle
            pos={{ left: "-14px", top: "50%", transform: "translateY(-50%)" }}
            cursor="ew-resize"
            onStart={(e) => startDrag(e, "left")}
            active={activeHandle === "left"}
            shape="v"
          />
          {/* Right */}
          <Handle
            pos={{ right: "-14px", top: "50%", transform: "translateY(-50%)" }}
            cursor="ew-resize"
            onStart={(e) => startDrag(e, "right")}
            active={activeHandle === "right"}
            shape="v"
          />
          {/* Top */}
          <Handle
            pos={{ top: "-14px", left: "50%", transform: "translateX(-50%)" }}
            cursor="ns-resize"
            onStart={(e) => startDrag(e, "top")}
            active={activeHandle === "top"}
            shape="h"
          />
          {/* Bottom */}
          <Handle
            pos={{ bottom: "-14px", left: "50%", transform: "translateX(-50%)" }}
            cursor="ns-resize"
            onStart={(e) => startDrag(e, "bottom")}
            active={activeHandle === "bottom"}
            shape="h"
          />

          {/* ── Corner handles ─────────────────────────────────────────────── */}
          <Handle
            pos={{ top: "-10px", left: "-10px" }}
            cursor="nwse-resize"
            onStart={(e) => startDrag(e, "tl")}
            active={activeHandle === "tl"}
            shape="corner"
          />
          <Handle
            pos={{ top: "-10px", right: "-10px" }}
            cursor="nesw-resize"
            onStart={(e) => startDrag(e, "tr")}
            active={activeHandle === "tr"}
            shape="corner"
          />
          <Handle
            pos={{ bottom: "-10px", left: "-10px" }}
            cursor="nesw-resize"
            onStart={(e) => startDrag(e, "bl")}
            active={activeHandle === "bl"}
            shape="corner"
          />
          <Handle
            pos={{ bottom: "-10px", right: "-10px" }}
            cursor="nwse-resize"
            onStart={(e) => startDrag(e, "br")}
            active={activeHandle === "br"}
            shape="corner"
          />

          {/* ── Rotation handle — above top-centre ────────────────────────── */}
          {/* Stem line */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "-32px",
              transform: "translateX(-50%)",
              width: "2px",
              height: "24px",
              background: "rgba(255,255,255,0.7)",
            }}
          />
          {/* Circle */}
          <div
            className={cn(
              "absolute flex items-center justify-center rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-colors z-30",
              activeHandle === "rotate" ? "bg-blue-400" : "bg-white"
            )}
            style={{
              width: 28,
              height: 28,
              left: "50%",
              top: "-60px",
              transform: "translateX(-50%)",
              touchAction: "none",
            }}
            onMouseDown={(e) => startDrag(e, "rotate")}
            onTouchStart={(e) => startDrag(e, "rotate")}
            title="Drag to rotate"
          >
            {/* Rotation icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7a5 5 0 1 1 1.5 3.5"
                stroke={activeHandle === "rotate" ? "white" : "#374151"}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M1 10.5 L3.5 10.5 L3.5 8"
                stroke={activeHandle === "rotate" ? "white" : "#374151"}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Hint */}
        {!activeHandle && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
            Drag centre to move · edges/corners to resize · circle to rotate
          </div>
        )}
      </div>


      {/* Confirm */}
      <button
        type="button"
        onClick={goNext}
        className="w-full bg-black text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
      >
        Confirm Placement →
      </button>
    </div>
  )
}

// ── Handle component ──────────────────────────────────────────────────────────

function Handle({
  pos,
  cursor,
  onStart,
  active,
  shape,
}: {
  pos: React.CSSProperties
  cursor: string
  onStart: (e: React.MouseEvent | React.TouchEvent) => void
  active: boolean
  shape: "h" | "v" | "corner"
}) {
  const base = "absolute z-20 flex items-center justify-center"

  // Dimensions by shape
  const dims =
    shape === "h"
      ? { width: 40, height: 14 }
      : shape === "v"
      ? { width: 14, height: 40 }
      : { width: 20, height: 20 }

  const inner =
    shape === "h"
      ? "w-8 h-2 rounded-full"
      : shape === "v"
      ? "w-2 h-8 rounded-full"
      : "w-4 h-4 rounded-sm rotate-45"

  return (
    <div
      className={base}
      style={{
        ...pos,
        width: dims.width,
        height: dims.height,
        cursor,
        // Invisible but large touch target
        touchAction: "none",
      }}
      onMouseDown={onStart}
      onTouchStart={onStart}
    >
      {/* Visible pill / square */}
      <div
        className={cn(
          inner,
          "transition-colors shadow-sm",
          active ? "bg-blue-400" : "bg-white"
        )}
      />
    </div>
  )
}

