import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "your-resend-api-key-here") {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

    const supabase = createServiceClient();

    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*, orders(order_number, product, total_value_usd), buyers(company, contact_name, email)")
      .eq("id", invoiceId)
      .single();

    if (error || !inv) {
      return NextResponse.json({ error: error?.message ?? "Invoice not found" }, { status: 404 });
    }

    const buyer = inv.buyers as { company: string; contact_name: string; email: string } | null;
    const order = inv.orders as { order_number: string; product: string; total_value_usd: number } | null;

    if (!buyer?.email) {
      return NextResponse.json({ error: "Buyer email not found" }, { status: 400 });
    }

    const fmtUSD = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="background:#047857;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BRINDARI</div>
                  <div style="font-size:12px;color:#a7f3d0;margin-top:4px;">Moringa Exports, India</div>
                </td>
                <td align="right">
                  <div style="font-size:11px;color:#a7f3d0;font-weight:600;letter-spacing:1px;">INVOICE</div>
                  <div style="font-size:18px;font-weight:700;color:#ffffff;margin-top:4px;">${inv.invoice_number}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#111827;">Dear ${buyer.contact_name ?? buyer.company},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Please find your invoice from Brindari for your recent moringa export order.
              Kindly review the details below and process the payment by the due date.
            </p>

            <!-- Invoice details card -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Invoice Number</td>
                      <td align="right" style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${inv.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Order Reference</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#111827;">${order?.order_number ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Product</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#111827;">${order?.product ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Issued Date</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#111827;">${inv.issued_date ?? "—"}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#6b7280;">Due Date</td>
                      <td align="right" style="padding:6px 0;font-size:13px;color:#dc2626;font-weight:600;">${inv.due_date ?? "—"}</td>
                    </tr>
                    <tr style="border-top:1px solid #a7f3d0;">
                      <td style="padding:12px 0 6px;font-size:15px;font-weight:700;color:#047857;">Total Due</td>
                      <td align="right" style="padding:12px 0 6px;font-size:18px;font-weight:800;color:#047857;">${fmtUSD(Number(inv.total_usd ?? 0))}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:13px;color:#6b7280;line-height:1.6;">
              For any queries regarding this invoice, please reply to this email or contact us at
              <a href="mailto:accounts@brindari.com" style="color:#047857;">accounts@brindari.com</a>.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#047857;border-radius:8px;padding:12px 24px;">
                  <a href="https://brindari.com/portal" style="color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">
                    View Invoice in Buyer Portal →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;">
              Thank you for your business.<br>
              <strong style="color:#111827;">Team Brindari</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Brindari Global · Maharashtra, India · brindari.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resend = new Resend(apiKey);
    const { error: sendError } = await resend.emails.send({
      from:    "Brindari <invoices@brindari.com>",
      to:      [buyer.email],
      subject: `Invoice ${inv.invoice_number} from Brindari — ${fmtUSD(Number(inv.total_usd ?? 0))} due ${inv.due_date ?? ""}`,
      html,
    });

    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Update invoice status
    await supabase
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", invoiceId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
