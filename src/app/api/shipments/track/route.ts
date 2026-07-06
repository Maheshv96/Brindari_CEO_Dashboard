import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey || apiKey === "your-aftership-api-key-here")
    return NextResponse.json({ error: "AFTERSHIP_API_KEY not configured" }, { status: 500 });

  try {
    const { shipmentId, trackingNumber, slug } = await req.json();
    if (!shipmentId || !trackingNumber || !slug)
      return NextResponse.json({ error: "shipmentId, trackingNumber and slug required" }, { status: 400 });

    // Call AfterShip API
    const res = await fetch(
      `https://api.aftership.com/v4/trackings/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}`,
      { headers: { "aftership-api-key": apiKey, "Content-Type": "application/json" } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (err as { message?: string }).message ?? `AfterShip error ${res.status}` }, { status: res.status });
    }

    const body = await res.json();
    const tracking = body?.data?.tracking ?? {};

    const tag                = tracking.tag as string | null ?? null;
    const checkpoints        = (tracking.checkpoints as { message?: string; checkpoint_time?: string }[]) ?? [];
    const last               = checkpoints[checkpoints.length - 1];
    const last_update        = last?.message ?? null;
    const expected_delivery  = (tracking.expected_delivery as string | null) ?? null;
    const carrier            = (tracking.slug as string | null) ?? slug;
    const isDelivered        = tag === "Delivered";

    const supabase = createServiceClient();

    // Update shipments row
    await supabase.from("shipments").update({
      status:            tag ?? "Unknown",
      tag,
      carrier,
      last_update,
      estimated_delivery: expected_delivery,
      ...(isDelivered ? { actual_delivery: new Date().toISOString().slice(0, 10) } : {}),
      raw_tracking:      tracking,
      updated_at:        new Date().toISOString(),
    }).eq("id", shipmentId);

    // If delivered, update the linked order
    if (isDelivered) {
      const { data: shipRow } = await supabase
        .from("shipments").select("order_id").eq("id", shipmentId).single();
      if (shipRow?.order_id) {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", shipRow.order_id);
      }
    }

    return NextResponse.json({ success: true, tag, last_update });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Track failed" }, { status: 500 });
  }
}
