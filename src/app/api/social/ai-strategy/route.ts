import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { platform, kpi } = body as {
    platform: "facebook" | "linkedin";
    kpi: Record<string, number>;
  };

  const kpiSummary = Object.entries(kpi)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = `You are a social media growth strategist for Brindari Global — a premium organic moringa B2B export company targeting nutraceutical, food, beverage, and cosmetic formulators worldwide.

Current ${platform === "facebook" ? "Facebook" : "LinkedIn"} KPIs this week:
${kpiSummary}

Give exactly 4 specific, actionable strategy recommendations to improve organic reach and generate B2B leads. Each recommendation must:
- Have a short title (max 6 words)
- Have 1–2 sentence action description
- Have a specific metric target or tactic
- Be realistic for a small export brand

Respond in this exact JSON format (no markdown, no extra text):
{
  "tips": [
    { "title": "...", "action": "...", "target": "..." },
    { "title": "...", "action": "...", "target": "..." },
    { "title": "...", "action": "...", "target": "..." },
    { "title": "...", "action": "...", "target": "..." }
  ]
}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    const parsed = JSON.parse(content);
    return NextResponse.json({ tips: parsed.tips, generatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
