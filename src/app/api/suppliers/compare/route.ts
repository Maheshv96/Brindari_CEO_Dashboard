import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Supplier } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here")
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  try {
    const { suppliers }: { suppliers: Supplier[] } = await req.json();
    if (!suppliers?.length)
      return NextResponse.json({ error: "suppliers[] required" }, { status: 400 });

    const rows = suppliers.slice(0, 3).map((s, i) =>
      `Supplier ${i + 1}: ${s.company}
  Price: ₹${s.price_per_kg_inr ?? "?"}/kg
  MOQ: ${s.moq_kg ?? "?"}kg
  Lead time: ${s.lead_time_days ?? "?"} days
  Certifications: ${s.certifications?.join(", ") || "none listed"}
  Payment terms: ${s.payment_terms || "not specified"}
  Rating: ${s.rating ?? "?"}/5
  Location: ${s.location || "India"}`
    ).join("\n\n");

    const client = new Anthropic({ apiKey });
    const { content } = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 350,
      system:     "You are a procurement advisor for Brindari, an Indian moringa exporter. Be concise and direct. FSSAI certification is mandatory; organic is a premium differentiator. Lower MOQ is better for initial orders. Shorter lead times reduce working capital risk.",
      messages: [{
        role:    "user",
        content: `Compare these moringa suppliers and give a clear recommendation:\n\n${rows}\n\nProvide: (1) brief comparison, (2) who to go with and why, (3) one risk to watch. Under 180 words total.`,
      }],
    });

    const analysis = content[0].type === "text" ? content[0].text : "";
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Compare failed" }, { status: 500 });
  }
}
