import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/suppliers/discover/:jobId
export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const supabase = await createServerSupabaseClient();
  const { jobId } = params;

  const { data, error } = await supabase
    .from("supplier_discovery_jobs")
    .select("*")
    .eq("job_id", jobId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Job not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, job: data });
}
