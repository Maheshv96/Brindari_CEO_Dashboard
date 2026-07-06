import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import sharp from "sharp";
import {
  BRAND, EmailDetails,
  stripAiExtras, buildEmailHtml, buildEmailText,
} from "@/lib/email-html";

const SALES_EMAIL = BRAND.email;

function parseEmail(text: string): { subject: string; body: string } {
  const lines  = text.trim().split("\n");
  const subIdx = lines.findIndex(l => l.toLowerCase().startsWith("subject:"));
  if (subIdx === -1) return { subject: `Organic Moringa Enquiry — ${BRAND.name}`, body: stripAiExtras(text) };
  const subject = lines[subIdx].replace(/^subject:\s*/i, "").trim();
  const raw     = lines.slice(subIdx + 1).join("\n").replace(/^\n+/, "").trim();
  return { subject, body: stripAiExtras(raw) };
}

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || resendKey === "your-resend-api-key-here")
    return NextResponse.json({ error: "RESEND_API_KEY not configured." }, { status: 500 });

  try {
    const { to, emailText, details = {} } = await req.json();
    if (!to || !emailText)
      return NextResponse.json({ error: "to and emailText required" }, { status: 400 });

    const { subject, body } = parseEmail(emailText);
    const resend = new Resend(resendKey);

    // Fetch SVG from website, convert to PNG with sharp, embed as inline attachment
    const svgRes = await fetch("https://brindari.com/assets/logo-icon.svg").catch(() => null);
    const logoContent = svgRes?.ok
      ? await sharp(Buffer.from(await svgRes.arrayBuffer())).resize(160, 160).png().toBuffer()
      : null;

    const { data, error } = await resend.emails.send({
      from:    `${BRAND.name} <${process.env.RESEND_FROM_EMAIL ?? "hello@brindari.com"}>`,
      to:      [to],
      replyTo: SALES_EMAIL,
      subject: `[TEST] ${subject}`,
      html:    buildEmailHtml(body, details as EmailDetails, logoContent ? "cid:logo-brindari" : undefined),
      text:    buildEmailText(body, details as EmailDetails),
      ...(logoContent && {
        attachments: [{
          filename:     "logo.png",
          content:      logoContent,
          contentType: "image/png",
          contentId:    "logo-brindari",
        }],
      }),
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, id: data?.id, subject });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
