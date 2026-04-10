"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

const LS_KEY = "signai_lead"

interface LeadData {
  name: string
  email: string
  phone: string
  company: string
}

interface Props {
  storefrontFile?: File
  logoFile?: File
  onConfirm: (leadId: string | null) => void
  onClose: () => void
}

export function LeadCaptureModal({ storefrontFile, logoFile, onConfirm, onClose }: Props) {
  const [form, setForm] = useState<LeadData>({ name: "", email: "", phone: "", company: "" })
  const [prefilled, setPrefilled] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle")
  const [error, setError] = useState("")
  const nameRef = useRef<HTMLInputElement>(null)

  // Pre-fill from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed: LeadData = JSON.parse(stored)
        setForm(parsed)
        setPrefilled(true)
      }
    } catch {}
    nameRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.")
      return
    }

    setStatus("saving")
    setError("")

    try {
      const fd = new FormData()
      fd.append("name",    form.name.trim())
      fd.append("email",   form.email.trim())
      fd.append("phone",   form.phone.trim())
      fd.append("company", form.company.trim())
      if (storefrontFile) fd.append("storefront", storefrontFile)
      if (logoFile)       fd.append("logo",       logoFile)

      const res = await fetch("/api/leads", { method: "POST", body: fd })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(json.error ?? "Failed to save")

      // Persist to localStorage for next time
      localStorage.setItem(LS_KEY, JSON.stringify(form))

      onConfirm(json.id ?? null)
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-black rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Sign Generator</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-3">
            Almost there — where should we send your design?
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter your details to generate your sign mockup. We may follow up to help bring it to life.
          </p>
          {prefilled && (
            <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Welcome back — details pre-filled
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Boris Kaykov"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="boris@kaykovmedia.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555 123 4567"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Company Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Kaykov Media"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "saving"}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors mt-2",
              status === "saving"
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            )}
          >
            {status === "saving" ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Confirm & Generate My Sign"
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Your details are only used to follow up on your sign request.
          </p>
        </form>
      </div>
    </div>
  )
}
