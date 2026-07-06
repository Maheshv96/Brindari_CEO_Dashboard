import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

const SEQUENCE_CONTEXT: Record<number, string> = {
  1: "initial cold outreach — introduce Brindari Global, mention a relevant market fact about the buyer's country",
  2: "first follow-up (no response) — brief, reference previous email, add a specific value point",
  3: "value-add follow-up — lead with certifications and offer a free sample shipment",
  4: "direct ask — one simple yes/no question about their timeline or interest",
  5: "break-up email — respectful close, leave door open, very short (4-5 lines max)",
};

const COUNTRY_CONTEXT: Record<string, string> = {
  "Germany":             "health-conscious consumers, strict quality standards, BIO/Organic certification highly valued",
  "United States":       "large supplement market, FDA-awareness important, clean-label trend",
  "United Kingdom":      "health food retail chains, clean-label, sustainability focus",
  "France":              "cosmetics and natural beauty industry, moringa oil demand",
  "Netherlands":         "major EU import hub, bulk buyers, sustainability and traceability focus",
  "Japan":               "premium quality obsession, small trial quantities first, long-term relationships",
  "South Korea":         "K-beauty and wellness trends, premium packaging expected",
  "United Arab Emirates":"re-export hub, halal certification preferred, bulk buyers",
  "Australia":           "TGA awareness, clean-label, therapeutic goods market",
  "South Africa":        "growing wellness market, price-sensitive, competitive FOB pricing important",
  "Denmark":             "strict EU organic standards, sustainability-driven buyers",
  "Switzerland":         "premium health food market, high FOB price acceptable for quality",
  "Singapore":           "ASEAN distribution hub, food safety certifications important",
  "Canada":              "health food retail and naturopathic market, organic certification important",
  "Italy":               "nutraceuticals and functional food market, strong interest in organic superfoods",
  "Spain":               "growing health supplement market, price-conscious, EU certification preferred",
};

export async function POST(req: NextRequest) {
  try {
    const {
      product, target_country, company, contact_name,
      sequence_step = 1, tone = "professional",
      certifications = [], fob_price, moq, sample = "yes",
    } = await req.json();

    if (!product || !company)
      return NextResponse.json({ error: "product and company are required" }, { status: 400 });

    const step     = Number(sequence_step);
    const seqCtx   = SEQUENCE_CONTEXT[step] ?? SEQUENCE_CONTEXT[1];
    const cntryCtx = COUNTRY_CONTEXT[target_country] ?? `${target_country} market`;

    // Build offer details — factual, not salesy
    const offerLines: string[] = [];
    if (fob_price)             offerLines.push(`FOB pricing available (~$${fob_price}/kg indicative)`);
    if (moq)                   offerLines.push(`MOQ: ${moq} kg per order`);
    if (certifications.length) offerLines.push(`Certifications held: ${(certifications as string[]).join(", ")}`);
    if (sample === "yes")      offerLines.push("Sample shipment available on request (buyer pays freight)");

    const offerContext = offerLines.length
      ? `\nFactual product details to include naturally:\n${offerLines.map(l => `- ${l}`).join("\n")}`
      : "";

    const toneMap: Record<string, string> = {
      professional: "formal, concise and business-like — state facts, avoid superlatives",
      friendly:     "warm and approachable — conversational, like writing to a business partner",
      direct:       "very direct and concise — bullets where useful, no filler sentences",
      urgent:       "time-aware — reference seasonal harvest or allocation, mild urgency without pressure",
    };
    const toneInstr = toneMap[tone] ?? toneMap.professional;

    const result = await callAI({
      maxTokens: 700,
      system: `You write B2B outreach emails for Brindari Global, an organic moringa exporter from India.
Brand: "Brindari Global" | Website: www.brindari.com | Tagline: "Pure. Organic. Global."
Products: Organic Moringa Powder, Capsules, Oil, Seeds, Tea, Dried Leaf — sourced in India.
Brindari Global is a new exporter building its international buyer network.

WRITING RULES — NON-NEGOTIABLE:
- Tone: ${toneInstr}
- GREETING: Start with "Hi {contact_name}," — if no name, use "Hi there,"
- AFTER GREETING: Write 2-3 sentences scoping the opportunity for THEIR market specifically:
  • What their country/region is known for buying or using moringa for
  • What kind of business typically sources this product (importers, supplement brands, retailers, distributors)
  • Why India-sourced moringa is relevant to their market
  This must feel researched, not generic. Avoid "Germany's demand is growing" — be specific about WHO buys it and WHY.
- NEVER say "We are reaching out to explore whether there is potential for a sourcing conversation"
- NEVER mention specific price numbers — say "FOB pricing available on enquiry" instead
- NEVER say "I hope", "I am writing to", "I wanted to reach out"
- NEVER mention India's states, cities, or ports by name — "India" only
- NEVER say "premium", "high-quality", "leading", "prominent", "world-class"
- NEVER invent specs (mg, mesh size, packaging) — use only what is given
- NEVER say "ensure", "guarantee", "we believe our products will"
- NEVER say "mutually beneficial", "long-term partnership", "further assist"
- CERTIFICATIONS: If provided, list them. Always end cert line with nothing extra.
- SAMPLE OFFER: One sentence only — "A sample can be arranged on request (buyer arranges freight)."
- CLOSING: One neutral sentence, e.g. "Happy to share spec sheets or lab reports if useful."
- NO sign-off, NO "Best regards", NO name — the email template handles the signature
- Max 160 words in the body`,

      prompt: `Write a ${seqCtx} email for:
Company: ${company}
Contact: ${contact_name || "the buyer"}
Country: ${target_country} (${cntryCtx})
Product focus: ${product}
Sequence step: ${step}/5${offerContext}

STRUCTURE TO FOLLOW (Step 1 template — adapt for other steps):
1. One sentence opening relevant to their market/country — no hype
2. Short paragraph: introduce Brindari Global as an India-based moringa exporter, source directly from farms, handle processing and export documentation
3. Products line + mention expanding into other organic superfoods (do not promise)
4. If offer details provided — list as "Relevant details for your reference:" with bullet points
5. Closing line: offer to share spec sheets / lab reports / certs + sample available on request
6. NO signature, NO "Best regards", NO sign-off — the email template handles that

Output format exactly:
Subject: [subject line]

[email body only — stop before any sign-off]`,
    });

    return NextResponse.json({ email: result.text, provider: result.model });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 });
  }
}
