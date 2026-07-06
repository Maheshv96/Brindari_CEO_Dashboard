import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST /api/suppliers/discovered/:id/reject
// body (optional): { reason: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient();
  const { id } = params;

  let reason: string | null = null;
  try {
    const body = await req.json();
    reason = body.reason?.trim() || null;
  } catch {
    // no body is fine
  }

  const { data, error } = await supabase
    .from("discovered_suppliers")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message ?? "Supplier not found" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ success: true, message: "Supplier rejected" });
}
