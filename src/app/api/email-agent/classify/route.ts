import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { createServiceClient } from "@/lib/supabase-server";

type Classification = "interested" | "not_interested" | "needs_info";
const SCORE_DELTA: Record<Classification, number> = { interested: 30, needs_info: 10, not_interested: -20 };

export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: logs, error: logErr } = await supabase
      .from("email_logs").select("id, lead_id, body")
      .eq("campaign_id", campaignId).eq("status", "replied").is("classification", null);

    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });
    if (!logs?.length) return NextResponse.json({ classified: 0, breakdown: { interested: 0, not_interested: 0, needs_info: 0 } });

    const breakdown = { interested: 0, not_interested: 0, needs_info: 0 };
    const logUpdates: { id: string; classification: Classification }[] = [];
    const leadUpdates: { id: string; delta: number; makeQualified: boolean }[] = [];

    for (const log of logs) {
      if (!log.body) continue;
      const result = await callAI({
        maxTokens: 100,
        system: "Classify email replies for a moringa export company. Reply with exactly one word: INTERESTED, NOT_INTERESTED, or NEEDS_INFO.",
        prompt:  `Classify this reply:\n\n${log.body.slice(0, 800)}`,
      });
      const raw = result.text.trim().toUpperCase();
      const classification: Classification =
        raw.includes("INTERESTED") && !raw.includes("NOT") ? "interested"
        : raw.includes("NOT_INTERESTED") || raw.includes("NOT INTERESTED") ? "not_interested"
        : "needs_info";

      breakdown[classification]++;
      logUpdates.push({ id: log.id, classification });
      if (log.lead_id) leadUpdates.push({ id: log.lead_id, delta: SCORE_DELTA[classification], makeQualified: classification === "interested" });
    }

    await Promise.all(logUpdates.map(({ id, classification }) =>
      supabase.from("email_logs").update({ classification }).eq("id", id)
    ));

    if (leadUpdates.length) {
      const { data: leads } = await supabase.from("leads").select("id, lead_score, status").in("id", leadUpdates.map(l => l.id));
      await Promise.all((leads ?? []).map(lead => {
        const upd = leadUpdates.find(u => u.id === lead.id);
        if (!upd) return Promise.resolve();
        const newScore = Math.max(0, Math.min(100, (lead.lead_score ?? 50) + upd.delta));
        return supabase.from("leads").update({ lead_score: newScore, ...(upd.makeQualified && lead.status === "contacted" ? { status: "qualified" } : {}) }).eq("id", lead.id);
      }));
    }

    await supabase.from("email_campaigns").update({ interested_count: breakdown.interested }).eq("id", campaignId);
    return NextResponse.json({ classified: logUpdates.length, breakdown });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Classify failed" }, { status: 500 });
  }
}
