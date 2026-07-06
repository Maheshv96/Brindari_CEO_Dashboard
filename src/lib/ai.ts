/**
 * AI provider helper — uses Groq (free) when available, falls back to Anthropic.
 * Groq: console.groq.com — 14,400 req/day free, uses Llama 3.1 8B
 * Anthropic: console.anthropic.com — pay per use, uses Claude Haiku
 */

interface AIMessage { role: "user" | "assistant" | "system"; content: string; }

interface AIResponse { text: string; provider: "groq" | "anthropic"; model: string; }

export async function callAI({
  system,
  prompt,
  maxTokens = 600,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<AIResponse> {
  const groqKey      = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const groqReady      = groqKey      && groqKey      !== "your-groq-api-key-here";
  const anthropicReady = anthropicKey && anthropicKey !== "your-anthropic-api-key-here";

  if (!groqReady && !anthropicReady) {
    throw new Error(
      "No AI key configured. Add GROQ_API_KEY (free) from console.groq.com " +
      "or ANTHROPIC_API_KEY from console.anthropic.com to .env.local"
    );
  }

  // Prefer Groq (free)
  if (groqReady) {
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: groqKey });
    const messages: AIMessage[] = [
      { role: "system",  content: system },
      { role: "user",    content: prompt },
    ];
    const res = await groq.chat.completions.create({
      model:      "llama-3.1-8b-instant",
      max_tokens: maxTokens,
      messages,
    });
    return {
      text:     res.choices[0]?.message?.content ?? "",
      provider: "groq",
      model:    "llama-3.1-8b-instant (free)",
    };
  }

  // Fallback: Anthropic Claude Haiku
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: anthropicKey });
  const res = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system,
    messages:   [{ role: "user", content: prompt }],
  });
  return {
    text:     res.content[0].type === "text" ? res.content[0].text : "",
    provider: "anthropic",
    model:    "claude-haiku-4-5",
  };
}
