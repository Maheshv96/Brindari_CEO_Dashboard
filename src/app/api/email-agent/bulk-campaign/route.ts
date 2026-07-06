import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { Resend } from "resend";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase-server";
import {
  BRAND, EmailDetails, MARKET_PRICING,
  stripAiExtras, buildEmailHtml, buildEmailText,
} from "@/lib/email-html";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Buyer stage variations (Priority 5) ───────────────────────────────────────
const SEQUENCE_CONTEXT: Record<number, { prompt: string; subjectPrefix: string; showDocs: boolean }> = {
  1: {
    prompt:        "cold outreach — quick credibility: one sharp market insight for that country, top 3 certifications mention, FOB range, sample offer. CTA: 'Reply to discuss your requirements'. Max 100 words.",
    subjectPrefix: "cold",
    showDocs:      false,
  },
  2: {
    prompt:        "detailed inquiry follow-up — complete information: all certifications with explanations, full specs, documentation availability. CTA: 'Request a sample to evaluate quality'. Max 130 words.",
    subjectPrefix: "inquiry",
    showDocs:      true,
  },
  3: {
    prompt:        "sample follow-up — close the deal: reference the sample sent, bulk pricing, payment flexibility (L/C, T/T), clear order process steps. CTA: 'Place your first order'. Max 100 words.",
    subjectPrefix: "sample",
    showDocs:      false,
  },
  4: {
    prompt:        "direct ask — one simple question about their sourcing timeline or current supplier situation. Very short (4-5 lines max). CTA: single direct question.",
    subjectPrefix: "follow-up",
    showDocs:      false,
  },
  5: {
    prompt:        "retention / reorder reminder — mention new products or seasonal availability, easy reorder process, special offer if applicable. CTA: 'Restock with us'. Max 80 words.",
    subjectPrefix: "retention",
    showDocs:      false,
  },
};

// ── Subject line templates (Priority 7) ───────────────────────────────────────
function buildSubject(aiSubject: string, fobPrice: string | undefined, stage: number): string {
  const fob = fobPrice ? `FOB $${fobPrice}/kg` : "";
  const templates: Record<number, string> = {
    1: fob ? `Premium Organic Moringa from India — ${fob}` : `Premium Organic Moringa from India — Brindari Global`,
    2: aiSubject || `Moringa Specifications & Documentation — Brindari Global`,
    3: `Your Moringa Sample — Next Steps | Brindari Global`,
    4: aiSubject || `Following up: Moringa Sourcing — Brindari Global`,
    5: `Restock Reminder: Organic Moringa — Brindari Global`,
  };
  return templates[stage] ?? aiSubject ?? `Organic Moringa Enquiry — ${BRAND.name}`;
}

function parseEmail(text: string): { subject: string; body: string } {
  const lines  = text.trim().split("\n");
  const subIdx = lines.findIndex(l => l.toLowerCase().startsWith("subject:"));
  if (subIdx === -1) return { subject: "", body: stripAiExtras(text) };
  const subject = lines[subIdx].replace(/^subject:\s*/i, "").trim();
  const raw     = lines.slice(subIdx + 1).join("\n").replace(/^\n+/, "").trim();
  return { subject, body: stripAiExtras(raw) };
}

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@brindari.com";

  if (!resendKey || resendKey === "your-resend-api-key-here")
    return NextResponse.json({ error: "RESEND_API_KEY not configured." }, { status: 500 });

  try {
    const {
      campaignId, leads, product, sequenceStep = 1,
      // Product details from campaign settings
      fob_price, moq, certifications, sample = true,
    } = await req.json();

    if (!campaignId || !leads?.length)
      return NextResponse.json({ error: "campaignId and leads[] required" }, { status: 400 });

    const supabase  = createServiceClient();
    const resend    = new Resend(resendKey);
    const stage     = SEQUENCE_CONTEXT[sequenceStep] ?? SEQUENCE_CONTEXT[1];

    const validLeads = (leads as { id: string; email?: string; company: string; contact_name?: string; country: string }[])
      .filter(l => l.email?.includes("@"));

    // Fetch SVG from website once, convert to PNG, reuse for all emails in this campaign
    const svgRes = await fetch("https://brindari.com/assets/logo-icon.svg").catch(() => null);
    const logoContent = svgRes?.ok
      ? await sharp(Buffer.from(await svgRes.arrayBuffer())).resize(160, 160).png().toBuffer()
      : null;

    const logs: Record<string, unknown>[] = [];
    let sent = 0;

    for (const lead of validLeads) {
      try {
        // Market-specific pricing — use explicit values or fall back to market table
        const mkt         = MARKET_PRICING[lead.country];
        const effectiveFob = fob_price || (mkt ? String(mkt.fob) : undefined);
        const effectiveMoq = moq       || (mkt ? String(mkt.moq) : undefined);
        const effectivePort = mkt?.port || "Mumbai/JNPT";

        const details: EmailDetails = {
          product:        product       || undefined,
          fob_price:      effectiveFob,
          moq:            effectiveMoq,
          port:           effectivePort,
          certifications: Array.isArray(certifications) && certifications.length ? certifications : undefined,
          sample:         sample !== false,
          show_docs:      stage.showDocs,
          stage:          sequenceStep,
        };

        const offerLines = [
          effectiveFob && `FOB ~$${effectiveFob}/kg`,
          effectiveMoq && `MOQ ${effectiveMoq} kg`,
          details.certifications?.length && `Certifications: ${details.certifications.join(", ")}`,
          sample && "Sample available on request",
        ].filter(Boolean);
        const offerContext = offerLines.length
          ? `\nOffer context:\n${offerLines.map(l => `- ${l}`).join("\n")}`
          : "";

        const result = await callAI({
          maxTokens: 400,
          system: `You write B2B outreach emails for ${BRAND.name}, an organic moringa exporter from Maharashtra, India.
Brand: "${BRAND.name}" | Tagline: "Pure. Organic. Global."
RULES: Source region is Maharashtra, India. Never say "high-quality", "leading", "premium". Never invent specs. No sign-off — template adds signature. Max 120 words in body.`,
          prompt: `Write a ${stage.prompt} email for:
Company: ${lead.company}
Contact: ${lead.contact_name || "the buyer"}
Country: ${lead.country}
Product: ${product}
Stage: ${sequenceStep}/5${offerContext}

Format:
Subject: [subject line]

Hi ${lead.contact_name || "there"},

[2-3 paragraphs max — market insight + brief intro. NO bullet specs — template handles those]`,
        });

        const { subject: aiSubject, body } = parseEmail(result.text);
        const subject = buildSubject(aiSubject, effectiveFob, sequenceStep);

        const { error: sendErr } = await resend.emails.send({
          from:    `${BRAND.name} <${fromEmail}>`,
          to:      [lead.email!],
          replyTo: BRAND.email,
          subject: subject,
          html:    buildEmailHtml(body, details, logoContent ? "cid:logo-brindari" : undefined),
          text:    buildEmailText(body, details),
          ...(logoContent && {
            attachments: [{
              filename:     "logo.png",
              content:      logoContent,
              contentType: "image/png",
              contentId:    "logo-brindari",
            }],
          }),
        });

        logs.push({
          campaign_id:   campaignId,
          lead_id:       lead.id,
          email_to:      lead.email,
          subject,
          body,
          sequence_step: sequenceStep,
          status:        sendErr ? "queued" : "sent",
          sent_at:       sendErr ? null : new Date().toISOString(),
        });

        if (!sendErr) sent++;
        await delay(200);
      } catch {
        logs.push({ campaign_id: campaignId, lead_id: lead.id, email_to: lead.email, sequence_step: sequenceStep, status: "queued" });
      }
    }

    if (logs.length) await supabase.from("email_logs").insert(logs);

    await supabase.from("email_campaigns")
      .update({ emails_sent: sent, status: "active" })
      .eq("id", campaignId);

    return NextResponse.json({ success: true, sent, queued: validLeads.length - sent, total: leads.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Campaign failed" }, { status: 500 });
  }
}
