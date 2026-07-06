import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase-server";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    confirmed:       "#d1fae5;color:#065f46",
    "in-production": "#e0e7ff;color:#3730a3",
    "quality-check": "#ede9fe;color:#5b21b6",
    "ready-to-ship": "#cffafe;color:#0e7490",
    shipped:         "#ccfbf1;color:#0f766e",
    "in-transit":    "#bae6fd;color:#0369a1",
    delivered:       "#bbf7d0;color:#15803d",
    cancelled:       "#f3f4f6;color:#6b7280",
  };
  const style = colors[status] ?? "#f3f4f6;color:#6b7280";
  const [bg, col] = style.split(";");
  return `<span style="background:${bg};${col};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">${status}</span>`;
}

// ── Core report generator ──────────────────────────────────────────────────────
async function generateReport() {
  const resendKey  = process.env.RESEND_API_KEY;
  const ceoEmail   = process.env.CEO_EMAIL;
  const fromEmail  = process.env.RESEND_FROM_EMAIL ?? "noreply@brindari.com";

  if (!resendKey || resendKey === "your-resend-api-key-here")
    throw new Error("RESEND_API_KEY not configured");
  if (!ceoEmail)
    throw new Error("CEO_EMAIL not configured");

  const supabase = createServiceClient();
  const weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const today    = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });

  // ── Parallel data fetch ──────────────────────────────────────────────────────
  const [
    { count: newLeadsCount },
    { data: allLeads },
    { count: newOrdersCount },
    { data: activeOrders },
    { data: paidInvoices },
    { data: pendingInvoices },
    { data: shipments },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("leads").select("status"),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("orders")
      .select("order_number, product, status, total_value_usd, buyers(company)")
      .not("status", "in", '("delivered","cancelled")')
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("invoices").select("total_usd").eq("status", "paid").gte("paid_at", weekAgo),
    supabase.from("invoices")
      .select("total_usd, invoice_number, buyers(company)")
      .in("status", ["sent", "overdue"]),
    supabase.from("shipments")
      .select("tracking_number, last_update, orders(order_number, buyers(company))")
      .eq("tag", "InTransit")
      .limit(5),
  ]);

  // ── Computed values ───────────────────────────────────────────────────────────
  const weeklyRevenue  = (paidInvoices  ?? []).reduce((s, i) => s + (i.total_usd ?? 0), 0);
  const pendingValue   = (pendingInvoices ?? []).reduce((s, i) => s + (i.total_usd ?? 0), 0);
  const leads          = (allLeads ?? []) as { status: string }[];
  const qualifiedLeads = leads.filter(l => l.status === "qualified").length;
  const closedLeads    = leads.filter(l => l.status === "closed").length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders  = (activeOrders    ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ships   = (shipments       ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (pendingInvoices ?? []) as any[];

  // ── HTML email ────────────────────────────────────────────────────────────────
  const ordersRows = orders.map(o => `
    <tr style="border-bottom:1px solid #f0fdf4;">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#065f46;">${o.order_number}</td>
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${o.buyers?.company ?? "—"}</td>
      <td style="padding:8px 12px;">${statusBadge(o.status)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#111827;text-align:right;">${fmtUSD(o.total_value_usd)}</td>
    </tr>`).join("") || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af;font-size:13px;">No active orders</td></tr>`;

  const shipRows = ships.map(s => `
    <tr style="border-bottom:1px solid #f0f9ff;">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#0369a1;">${s.tracking_number ?? "—"}</td>
      <td style="padding:8px 12px;font-size:13px;color:#111827;">${s.orders?.order_number ?? "—"} · ${s.orders?.buyers?.company ?? "—"}</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;max-width:240px;">${s.last_update ?? "Tracking update pending"}</td>
    </tr>`).join("") || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#9ca3af;font-size:13px;">No shipments in transit</td></tr>`;

  const pendingRows = pending.slice(0, 5).map(i => `
    <tr style="border-bottom:1px solid #fffbeb;">
      <td style="padding:6px 12px;font-family:monospace;font-size:12px;color:#b45309;">${i.invoice_number}</td>
      <td style="padding:6px 12px;font-size:13px;color:#111827;">${i.buyers?.company ?? "—"}</td>
      <td style="padding:6px 12px;font-size:13px;font-weight:600;text-align:right;color:#b45309;">${fmtUSD(i.total_usd)}</td>
    </tr>`).join("") || `<tr><td colspan="3" style="padding:12px;text-align:center;color:#9ca3af;font-size:13px;">No outstanding invoices</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 16px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #a7f3d0;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#064e3b 0%,#047857 100%);padding:32px 40px;">
    <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;">🌿 Brindari</div>
    <div style="font-size:15px;color:#a7f3d0;margin-top:4px;font-weight:600;letter-spacing:1px;">WEEKLY BUSINESS SUMMARY</div>
    <div style="font-size:12px;color:#6ee7b7;margin-top:8px;">${today}</div>
  </td></tr>

  <!-- THIS WEEK'S NUMBERS -->
  <tr><td style="padding:28px 40px 0;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">This Week</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;padding:0 6px 12px 0;">
          <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;">
            <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">New Leads</div>
            <div style="font-size:28px;font-weight:800;color:#065f46;margin-top:4px;">${newLeadsCount ?? 0}</div>
          </div>
        </td>
        <td style="width:50%;padding:0 0 12px 6px;">
          <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px 20px;">
            <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">New Orders</div>
            <div style="font-size:28px;font-weight:800;color:#065f46;margin-top:4px;">${newOrdersCount ?? 0}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 6px 0 0;">
          <div style="background:#065f46;border-radius:10px;padding:16px 20px;">
            <div style="font-size:11px;color:#a7f3d0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Revenue Collected</div>
            <div style="font-size:24px;font-weight:800;color:#fff;margin-top:4px;">${fmtUSD(weeklyRevenue)}</div>
          </div>
        </td>
        <td style="padding:0 0 0 6px;">
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;">
            <div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Outstanding</div>
            <div style="font-size:24px;font-weight:800;color:#b45309;margin-top:4px;">${fmtUSD(pendingValue)}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- LEAD PIPELINE -->
  <tr><td style="padding:24px 40px 0;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Lead Pipeline</div>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 20px;display:flex;gap:24px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="text-align:center;padding:0 12px;">
          <div style="font-size:22px;font-weight:800;color:#7c3aed;">${qualifiedLeads}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Qualified</div>
        </td>
        <td style="text-align:center;padding:0 12px;">
          <div style="font-size:22px;font-weight:800;color:#059669;">${closedLeads}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Closed (Won)</div>
        </td>
        <td style="text-align:center;padding:0 12px;">
          <div style="font-size:22px;font-weight:800;color:#111827;">${leads.length}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Total Leads</div>
        </td>
      </tr></table>
    </div>
  </td></tr>

  <!-- ACTIVE ORDERS -->
  <tr><td style="padding:24px 40px 0;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Active Orders</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Order #</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Buyer</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;">Status</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;">Value</th>
      </tr>
      ${ordersRows}
    </table>
  </td></tr>

  <!-- OUTSTANDING INVOICES -->
  <tr><td style="padding:24px 40px 0;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Outstanding Invoices</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fde68a;border-radius:10px;overflow:hidden;">
      <tr style="background:#fffbeb;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;font-weight:600;">Invoice #</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;font-weight:600;">Buyer</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#92400e;font-weight:600;">Amount</th>
      </tr>
      ${pendingRows}
    </table>
  </td></tr>

  <!-- SHIPMENTS IN TRANSIT -->
  <tr><td style="padding:24px 40px 0;">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Shipments In Transit</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #bae6fd;border-radius:10px;overflow:hidden;">
      <tr style="background:#f0f9ff;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#0369a1;font-weight:600;">Tracking #</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#0369a1;font-weight:600;">Order / Buyer</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#0369a1;font-weight:600;">Last Update</th>
      </tr>
      ${shipRows}
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:28px 40px;text-align:center;border-top:1px solid #e5e7eb;margin-top:24px;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Auto-generated every Monday 8am IST · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}" style="color:#047857;text-decoration:none;">Open Dashboard →</a></p>
    <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Brindari Exports Pvt Ltd · brindari.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const resend = new Resend(resendKey);
  const { error: sendErr } = await resend.emails.send({
    from:    `Brindari Reports <${fromEmail}>`,
    to:      [ceoEmail],
    subject: `📊 Brindari Weekly Report — ${today}`,
    html,
  });

  if (sendErr) throw new Error(sendErr.message);

  return {
    success: true,
    summary: {
      newLeads:       newLeadsCount ?? 0,
      newOrders:      newOrdersCount ?? 0,
      weeklyRevenue,
      pendingValue,
      activeOrders:   orders.length,
    },
  };
}

// ── GET — Vercel Cron (Monday 2:30 UTC = 8am IST) ─────────────────────────────
export async function GET(req: NextRequest) {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await generateReport();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

// ── POST — Manual trigger from dashboard ──────────────────────────────────────
export async function POST() {
  try {
    const result = await generateReport();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
