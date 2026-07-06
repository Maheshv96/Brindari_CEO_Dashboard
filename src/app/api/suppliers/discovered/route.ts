import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/suppliers/discovered?score_min=0&state=&source=&status=new,approved&limit=100&offset=0
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);

  const scoreMin = parseInt(searchParams.get("score_min") ?? "0", 10);
  const state    = searchParams.get("state") ?? "";
  const source   = searchParams.get("source") ?? "";
  const statuses = (searchParams.get("status") ?? "new,approved").split(",").filter(Boolean);
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);
  const offset   = parseInt(searchParams.get("offset") ?? "0", 10);
  const sortBy   = searchParams.get("sort_by") ?? "total_score";
  const sortDir  = searchParams.get("sort_dir") === "asc";

  const allowedSort = ["total_score", "rating", "created_at", "company_name"];
  const safeSort = allowedSort.includes(sortBy) ? sortBy : "total_score";

  let query = supabase
    .from("discovered_suppliers")
    .select("*", { count: "exact" })
    .gte("total_score", scoreMin)
    .in("status", statuses)
    .order(safeSort, { ascending: sortDir })
    .range(offset, offset + limit - 1);

  if (state) query = query.eq("state", state);
  if (source) query = query.eq("source", source);
  if (searchParams.get("has_contact") === "true") {
    query = query.or("phone.not.is.null,email.not.is.null");
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: data ?? [],
    pagination: {
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + limit < (count ?? 0),
    },
  });
}
