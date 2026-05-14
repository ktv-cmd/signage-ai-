import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── POST /api/leads ──────────────────────────────────────────────────────────
// Called when user submits the contact form (before generation).
// Saves lead + uploads storefront/logo to Supabase Storage.
// Returns { id } so the client can attach the generated image later.

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const name    = (formData.get("name")    as string | null)?.trim()
    const email   = (formData.get("email")   as string | null)?.trim()
    const phone   = (formData.get("phone")   as string | null)?.trim() || null
    const company = (formData.get("company") as string | null)?.trim() || null
    const storefrontFile = formData.get("storefront") as File | null
    const logoFile       = formData.get("logo")       as File | null

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = getSupabase()

    let storefrontUrl: string | null = null
    let logoUrl: string | null = null

    // ── Insert lead row first to get the ID ──────────────────────────────────
    let leadId: string | null = null

    if (supabase) {
      const { data, error } = await supabase
        .from("leads")
        .insert({ name, email, phone, company })
        .select("id")
        .single()

      if (error) {
        console.error("[leads] Supabase insert error:", error)
      } else {
        leadId = data.id
      }

      // ── Upload storefront photo ─────────────────────────────────────────────
      if (leadId && storefrontFile) {
        const buf = Buffer.from(await storefrontFile.arrayBuffer())
        const ext = storefrontFile.type.includes("png") ? "png" : "jpg"
        const { data: uploadData } = await supabase.storage
          .from("leads")
          .upload(`${leadId}/storefront.${ext}`, buf, {
            contentType: storefrontFile.type,
            upsert: true,
          })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("leads")
            .getPublicUrl(`${leadId}/storefront.${ext}`)
          storefrontUrl = publicUrl
          await supabase.from("leads").update({ storefront_url: storefrontUrl }).eq("id", leadId)
        }
      }

      // ── Upload logo ─────────────────────────────────────────────────────────
      if (leadId && logoFile) {
        const buf = Buffer.from(await logoFile.arrayBuffer())
        const ext = logoFile.type.includes("png") ? "png" : "jpg"
        const { data: uploadData } = await supabase.storage
          .from("leads")
          .upload(`${leadId}/logo.${ext}`, buf, {
            contentType: logoFile.type,
            upsert: true,
          })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("leads")
            .getPublicUrl(`${leadId}/logo.${ext}`)
          logoUrl = publicUrl
          await supabase.from("leads").update({ logo_url: logoUrl }).eq("id", leadId)
        }
      }
    }

    return NextResponse.json({ ok: true, id: leadId }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("[leads] POST error:", err)
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500, headers: CORS_HEADERS })
  }
}

// ─── PATCH /api/leads ─────────────────────────────────────────────────────────
// Called after generation completes.
// Uploads the generated image and sends the email notification.

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: string
      name: string
      email: string
      phone?: string
      company?: string
      generatedImageUrl?: string
      sign_width_in?: number | null
      sign_height_in?: number | null
      size_method?: string | null
      door_detected?: boolean | null
      door_confidence?: number | null
    }

    const { id, name, email, phone, company, generatedImageUrl } = body

    if (!id) {
      return NextResponse.json({ error: "Lead ID required" }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = getSupabase()
    const resend   = getResend()

    let generatedStoredUrl: string | null = null

    // ── Upload generated image ────────────────────────────────────────────────
    if (supabase && generatedImageUrl) {
      let imageBuffer: Buffer | null = null

      if (generatedImageUrl.startsWith("data:")) {
        // Strip the data: prefix and decode base64
        const base64 = generatedImageUrl.split(",")[1]
        if (base64) imageBuffer = Buffer.from(base64, "base64")
      } else {
        // Fetch remote URL (e.g. from Replicate or fal.ai)
        const res = await fetch(generatedImageUrl)
        if (res.ok) imageBuffer = Buffer.from(await res.arrayBuffer())
      }

      if (imageBuffer) {
        const { data: uploadData } = await supabase.storage
          .from("leads")
          .upload(`${id}/generated.jpg`, imageBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from("leads")
            .getPublicUrl(`${id}/generated.jpg`)
          generatedStoredUrl = publicUrl
        }
      }

      await supabase
        .from("leads")
        .update({ generated_url: generatedStoredUrl ?? generatedImageUrl })
        .eq("id", id)
    }

    // ── Fetch ALL lead data from DB as single source of truth ────────────────
    let leadData: { name: string; email: string; phone: string | null; company: string | null; storefront_url: string | null; logo_url: string | null; generated_url: string | null; sign_width_in: number | null; sign_height_in: number | null } | null = null
    if (supabase) {
      const { data } = await supabase.from("leads").select("name,email,phone,company,storefront_url,logo_url,generated_url,sign_width_in,sign_height_in").eq("id", id).single()
      if (data) leadData = data
    }
    const resolvedName    = leadData?.name    ?? name
    const resolvedEmail   = leadData?.email   ?? email
    const resolvedPhone   = leadData?.phone   ?? phone ?? null
    const resolvedCompany = leadData?.company ?? company ?? null
    const storefrontUrl   = leadData?.storefront_url ?? null
    const logoUrl         = leadData?.logo_url ?? null
    const generatedUrl    = leadData?.generated_url ?? null

    const fmt = (val: string | null | undefined, fallback = "—") => val?.trim() || fallback

    const hasSize = leadData?.sign_width_in != null && leadData?.sign_height_in != null

    // ── Send email notification ───────────────────────────────────────────────
    const notifyEmail = process.env.LEAD_NOTIFICATION_EMAIL
    const submittedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })

    if (resend && notifyEmail) {
      const adminHtml = `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#111">
  <h2 style="margin-bottom:4px">New Design Signage Lead</h2>
  <p style="color:#666;margin-top:0;font-size:13px">${submittedAt}</p>

  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Client Info</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;color:#666;width:140px;font-size:14px">Name</td><td style="padding:6px 0;font-weight:600;font-size:14px">${fmt(resolvedName)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;font-size:14px">Email</td><td style="padding:6px 0;font-weight:600;font-size:14px">${resolvedEmail ? `<a href="mailto:${resolvedEmail}" style="color:#111">${resolvedEmail}</a>` : "—"}</td></tr>
    ${resolvedPhone ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Phone</td><td style="padding:6px 0;font-weight:600;font-size:14px"><a href="tel:${resolvedPhone}" style="color:#111">${resolvedPhone}</a></td></tr>` : ""}
    ${resolvedCompany ? `<tr><td style="padding:6px 0;color:#666;font-size:14px">Company</td><td style="padding:6px 0;font-weight:600;font-size:14px">${resolvedCompany}</td></tr>` : ""}
  </table>

  ${hasSize ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Sign Size</h3>
  <p style="margin:0;font-size:15px;font-weight:600">${leadData?.sign_width_in}" × ${leadData?.sign_height_in}"</p>` : ""}

  ${generatedUrl ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Generated Mockup</h3>
  <a href="${generatedUrl}"><img src="${generatedUrl}" alt="Generated sign mockup" style="width:100%;border-radius:8px;display:block" /></a>
  <a href="${generatedUrl}" style="display:inline-block;margin-top:6px;color:#555;font-size:13px">View full image →</a>` : ""}

  ${storefrontUrl ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Storefront Photo</h3>
  <a href="${storefrontUrl}"><img src="${storefrontUrl}" alt="Storefront" style="width:100%;border-radius:8px;display:block" /></a>
  ` : ""}

  ${logoUrl ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Client Logo</h3>
  <a href="${logoUrl}"><img src="${logoUrl}" alt="Client logo" style="max-width:300px;border-radius:8px;display:block" /></a>
  ` : ""}
</div>`

      const adminSendResult = await resend.emails.send({
        from: "Kaykov Media <info@kaykovmedia.com>",
        to: ["ktv@kaykovmedia.com", "boris@kaykovmedia.com"],
        subject: `New Design Signage Lead — ${resolvedCompany || resolvedName}`,
        html: adminHtml,
      }).catch(console.error)

      if (adminSendResult && supabase) {
        await supabase.from("leads").update({ admin_email_sent_at: new Date().toISOString() }).eq("id", id)
      }
    }

    if (resend && resolvedEmail) {
      const clientHtml = `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#111">
  ${generatedUrl ? `
  <div style="margin-top:0">
    <img src="${generatedUrl}" alt="Your sign design" style="width:100%;border-radius:8px;display:block" />
  </div>` : ""}

  <p style="font-size:16px;margin-bottom:4px;margin-top:24px">Hi ${fmt(resolvedName)},</p>
  <p style="font-size:15px;color:#333;margin-top:0">Thank you for using Kaykov Media. Your sign design is ready and we will contact you shortly with a full quote.</p>

  ${hasSize ? `<p style="margin-top:12px;font-size:15px;font-weight:600">Estimated size: ${leadData?.sign_width_in}" × ${leadData?.sign_height_in}"</p>` : ""}

  ${storefrontUrl ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Your Storefront</h3>
  <img src="${storefrontUrl}" alt="Storefront" style="width:100%;border-radius:8px;display:block" />
  ` : ""}

  ${logoUrl ? `
  <h3 style="margin-top:24px;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#888">Your Logo</h3>
  <img src="${logoUrl}" alt="Logo" style="max-width:300px;border-radius:8px;display:block" />
  ` : ""}

  <p style="margin-top:24px;font-size:14px;color:#333">Best regards,</p>
  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee">
    <p style="margin:0;font-size:14px;font-weight:600">Boris</p>
    <p style="margin:4px 0 0;font-size:13px;color:#666">Kaykov Media</p>
    <p style="margin:2px 0 0;font-size:13px;color:#666"><a href="tel:+17184784200" style="color:#666">(718) 478-4200</a></p>
    <p style="margin:2px 0 0;font-size:13px;color:#666"><a href="https://signscompanynewyork.com" style="color:#666">signscompanynewyork.com</a></p>
  </div>
</div>`

      const clientSendResult = await resend.emails.send({
        from: "Kaykov Media <info@kaykovmedia.com>",
        to: resolvedEmail,
        subject: "Your sign design is ready!",
        html: clientHtml,
      }).catch(console.error)

      if (clientSendResult && supabase) {
        await supabase.from("leads").update({ client_email_sent_at: new Date().toISOString() }).eq("id", id)
      }
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error("[leads] PATCH error:", err)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500, headers: CORS_HEADERS })
  }
}
