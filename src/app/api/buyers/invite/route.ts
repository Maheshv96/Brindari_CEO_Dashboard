import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!resendKey || resendKey === "your-resend-api-key-here")
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  if (!serviceKey || serviceKey === "your-service-role-key-here")
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });

  try {
    const { buyerId } = await req.json();
    if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });

    const supabase = createServiceClient();

    // Fetch buyer
    const { data: buyer, error: bErr } = await supabase
      .from("buyers")
      .select("id, company, contact_name, email, portal_access")
      .eq("id", buyerId)
      .single();

    if (bErr || !buyer)
      return NextResponse.json({ error: bErr?.message ?? "Buyer not found" }, { status: 404 });

    if (!buyer.email)
      return NextResponse.json({ error: "Buyer has no email address" }, { status: 400 });

    // Generate Supabase magic link
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: buyer.email,
      options: {
        redirectTo: `${appUrl}/portal`,
        data: { buyer_id: buyer.id, role: "buyer" },
      },
    });

    if (linkErr || !linkData?.properties?.action_link)
      return NextResponse.json({ error: linkErr?.message ?? "Failed to generate magic link" }, { status: 500 });

    const magicLink = linkData.properties.action_link;

    // Send branded email
    const resend = new Resend(resendKey);
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #a7f3d0;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);padding:36px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">BRINDARI</div>
            <div style="font-size:12px;color:#a7f3d0;margin-top:6px;letter-spacing:1px;">BUYER PORTAL ACCESS</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#111827;">
              Welcome, ${buyer.contact_name ?? buyer.company} 👋
            </p>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;">
              You've been invited to access the <strong style="color:#047857;">Brindari Buyer Portal</strong> —
              your dedicated space to track your moringa export orders in real time.
            </p>

            <!-- Features grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="padding:0 6px 0 0;width:50%;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <div style="font-size:20px;margin-bottom:8px;">📦</div>
                      <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:4px;">Order Tracking</div>
                      <div style="font-size:12px;color:#6b7280;line-height:1.5;">Live status updates from confirmed to delivered</div>
                    </td></tr>
                  </table>
                </td>
                <td style="padding:0 0 0 6px;width:50%;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <div style="font-size:20px;margin-bottom:8px;">🧾</div>
                      <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:4px;">Invoices</div>
                      <div style="font-size:12px;color:#6b7280;line-height:1.5;">View and download your commercial invoices</div>
                    </td></tr>
                  </table>
                </td>
              </tr>
              <tr><td colspan="2" style="padding-top:12px;"></td></tr>
              <tr>
                <td style="padding:0 6px 0 0;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <div style="font-size:20px;margin-bottom:8px;">🚢</div>
                      <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:4px;">Shipment Tracking</div>
                      <div style="font-size:12px;color:#6b7280;line-height:1.5;">Real-time tracking of your shipments</div>
                    </td></tr>
                  </table>
                </td>
                <td style="padding:0 0 0 6px;vertical-align:top;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:16px;">
                    <tr><td>
                      <div style="font-size:20px;margin-bottom:8px;">📄</div>
                      <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:4px;">Documents</div>
                      <div style="font-size:12px;color:#6b7280;line-height:1.5;">BL, COO, phytosanitary certificates &amp; more</div>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center" style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);border-radius:10px;padding:18px 32px;">
                  <a href="${magicLink}"
                    style="color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;display:block;">
                    Access Your Portal →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Expiry note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:12px;color:#92400e;">
                    ⚠️ <strong>This link expires in 24 hours.</strong>
                    If it expires, contact us at <a href="mailto:support@brindari.com" style="color:#047857;">support@brindari.com</a> for a new invitation.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              If you didn't expect this email, you can safely ignore it.<br><br>
              Best regards,<br>
              <strong style="color:#111827;">Team Brindari</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Brindari Global · Maharashtra, India ·
              <a href="https://brindari.com" style="color:#047857;text-decoration:none;">brindari.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error: sendErr } = await resend.emails.send({
      from:    "Brindari <portal@brindari.com>",
      to:      [buyer.email],
      subject: `You're invited to the Brindari Buyer Portal — ${buyer.company}`,
      html,
    });

    if (sendErr)
      return NextResponse.json({ error: sendErr.message }, { status: 500 });

    // Mark portal_access = true on buyer
    await supabase
      .from("buyers")
      .update({ portal_access: true })
      .eq("id", buyerId);

    return NextResponse.json({ success: true, email: buyer.email });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
