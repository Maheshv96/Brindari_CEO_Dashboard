import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { DiscoveredSupplier } from "@/lib/supabase";

// POST /api/suppliers/discovered/:id/approve
//
// 1. Sets discovered_supplier.status = 'approved'
// 2. Inserts a record into the main `suppliers` table (if not already there)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient();
  const { id } = params;

  // Fetch the discovered supplier
  const { data: ds, error: fetchErr } = await supabase
    .from("discovered_suppliers")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !ds) {
    return NextResponse.json(
      { success: false, error: "Discovered supplier not found" },
      { status: 404 }
    );
  }

  const discovered = ds as DiscoveredSupplier;

  // Mark as approved
  const { error: updateErr } = await supabase
    .from("discovered_suppliers")
    .update({ status: "approved" })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json(
      { success: false, error: updateErr.message },
      { status: 500 }
    );
  }

  // Check if already in suppliers table
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .ilike("company", discovered.company_name)
    .limit(1);

  let supplierId: string | null = null;

  if (!existing || existing.length === 0) {
    // Map to suppliers table schema
    const payload = {
      company:          discovered.company_name,
      contact_name:     discovered.contact_person ?? discovered.company_name,
      email:            discovered.email ?? null,
      location:         discovered.location ?? null,
      product:          "Moringa",
      certifications:   discovered.certifications?.length ? discovered.certifications : null,
      rating:           discovered.rating ?? null,
      is_active:        true,
    };

    const { data: newSupplier, error: insertErr } = await supabase
      .from("suppliers")
      .insert(payload)
      .select("id")
      .single();

    if (insertErr) {
      // Approval persisted even if suppliers insert fails — non-fatal
      console.error("Could not insert into suppliers table:", insertErr.message);
    } else {
      supplierId = newSupplier?.id ?? null;
    }
  } else {
    supplierId = existing[0].id;
  }

  return NextResponse.json({
    success: true,
    message: "Supplier approved" + (supplierId ? " and added to /suppliers" : ""),
    supplier_id: supplierId,
  });
}
