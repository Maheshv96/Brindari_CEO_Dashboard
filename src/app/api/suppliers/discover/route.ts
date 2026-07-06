import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { discoverSuppliers } from "@/lib/supplier-scraper";

/**
 * POST /api/suppliers/discover
 *
 * Scrapes IndiaMART Export Portal + Google Maps for genuine verified exporters.
 * Only suppliers with a confirmed phone number are saved.
 *
 * Upsert behaviour:
 *  - Existing record (matched by company_name) → UPDATE contact details, preserve status
 *  - New record                                 → INSERT with status = "new"
 *
 * Never deletes approved/rejected decisions.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await supabase.from("supplier_discovery_jobs").insert({ job_id: jobId, status: "running" });

  try {
    // ── Scrape ────────────────────────────────────────────────────────────────
    const { suppliers, sources } = await discoverSuppliers();

    if (suppliers.length === 0) {
      await supabase.from("supplier_discovery_jobs").update({
        status: "completed", suppliers_found: 0, completed_at: new Date().toISOString(),
      }).eq("job_id", jobId);
      return NextResponse.json({ success: true, jobId, suppliers_found: 0, sources, note: "No suppliers with complete contact info found this run." });
    }

    // ── Load existing records (to preserve status & detect updates) ───────────
    const { data: existing } = await supabase
      .from("discovered_suppliers")
      .select("id, company_name, status");

    const existingMap = new Map(
      (existing ?? []).map((e: { id: string; company_name: string; status: string }) =>
        [e.company_name.toLowerCase().trim(), { id: e.id, status: e.status }]
      )
    );

    // ── Upsert ────────────────────────────────────────────────────────────────
    let inserted = 0;
    let updated  = 0;

    for (const s of suppliers) {
      const key = s.company_name.toLowerCase().trim();
      const found = existingMap.get(key);

      if (found) {
        // UPDATE — refresh all contact fields, preserve review status
        const { error } = await supabase
          .from("discovered_suppliers")
          .update({
            phone:             s.phone         ?? null,
            email:             s.email         ?? null,
            website:           s.website       ?? null,
            address:           s.address       ?? null,
            location:          s.location      ?? null,
            state:             s.state         ?? null,
            rating:            s.rating        ?? null,
            certifications:    s.certifications ?? [],
            organic_certified: s.organic_certified ?? false,
            verified:          s.verified      ?? false,
            iec_verified:      s.iec_verified  ?? false,
            total_score:       s.total_score   ?? 0,
            source_url:        s.source_url    ?? null,
            // status intentionally NOT updated — preserve user's decision
          })
          .eq("id", found.id);
        if (!error) updated++;
      } else {
        // INSERT — new supplier found
        const { error } = await supabase
          .from("discovered_suppliers")
          .insert({ ...s, status: "new" });
        if (!error) inserted++;
      }
    }

    // ── Complete job ──────────────────────────────────────────────────────────
    await supabase.from("supplier_discovery_jobs").update({
      status:          "completed",
      suppliers_found: inserted + updated,
      completed_at:    new Date().toISOString(),
    }).eq("job_id", jobId);

    return NextResponse.json({
      success:         true,
      jobId,
      suppliers_found: inserted + updated,
      inserted,
      updated,
      sources,
      ai_powered:      false,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    await supabase.from("supplier_discovery_jobs").update({
      status: "failed", error_message: message, completed_at: new Date().toISOString(),
    }).eq("job_id", jobId);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
