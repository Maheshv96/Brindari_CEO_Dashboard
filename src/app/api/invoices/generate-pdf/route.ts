import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  try {
    // Accept either { invoiceId } (fetch from DB) or { invoice } (pre-loaded data)
    const body = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inv: any;

    if (body.invoice) {
      // Client passed full invoice data — no service key needed
      inv = body.invoice;
    } else if (body.invoiceId) {
      // Fallback: fetch with anon key (works when anon policies are enabled)
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invoices")
        .select("*, orders(order_number, product, quantity_kg, fob_price_usd, total_value_usd, incoterm, hs_code, payment_terms, destination_port), buyers(company, contact_name, email, country, address)")
        .eq("id", body.invoiceId)
        .single();
      if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
      inv = data;
    } else {
      return NextResponse.json({ error: "invoice or invoiceId required" }, { status: 400 });
    }

    const order = inv.orders  as Record<string, unknown> | null;
    const buyer = inv.buyers  as Record<string, unknown> | null;

    const fmtUSD = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 50, 40, 60],
      defaultStyle: { font: "Helvetica", fontSize: 10, color: "#1f2937" },

      content: [
        // ── Header ────────────────────────────────────────────────────────
        {
          columns: [
            {
              stack: [
                { text: "BRINDARI", style: "brand" },
                { text: "Moringa Exports, India", fontSize: 9, color: "#6b7280", margin: [0, 2, 0, 0] },
                { text: "brindari.com", fontSize: 9, color: "#047857" },
              ],
            },
            {
              stack: [
                { text: "COMMERCIAL INVOICE", style: "invoiceTitle" },
                { text: inv.invoice_number, fontSize: 13, bold: true, color: "#047857", margin: [0, 4, 0, 0] },
                { text: `Issued: ${inv.issued_date ?? "—"}`, fontSize: 9, color: "#6b7280", margin: [0, 4, 0, 0] },
                { text: `Due: ${inv.due_date ?? "—"}`, fontSize: 9, color: "#6b7280" },
              ],
              alignment: "right",
            },
          ],
          margin: [0, 0, 0, 12],
        },

        // ── Emerald divider ───────────────────────────────────────────────
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#047857" }], margin: [0, 0, 0, 16] },

        // ── Bill To + Shipment Details ─────────────────────────────────────
        {
          columns: [
            {
              width: "50%",
              stack: [
                { text: "BILL TO", style: "sectionLabel" },
                { text: (buyer?.company as string) ?? "—", bold: true, margin: [0, 4, 0, 2] },
                { text: (buyer?.contact_name as string) ?? "", fontSize: 9, color: "#6b7280" },
                { text: (buyer?.email as string) ?? "", fontSize: 9, color: "#6b7280" },
                { text: (buyer?.country as string) ?? "", fontSize: 9, color: "#6b7280" },
                { text: (buyer?.address as string) ?? "", fontSize: 9, color: "#6b7280" },
              ],
            },
            {
              width: "50%",
              stack: [
                { text: "SHIPMENT DETAILS", style: "sectionLabel" },
                { text: `Order Ref: ${(order?.order_number as string) ?? "—"}`, fontSize: 9, margin: [0, 4, 0, 2] },
                { text: `Incoterm: ${(order?.incoterm as string) ?? "—"}`, fontSize: 9 },
                { text: `HS Code: ${(order?.hs_code as string) ?? "—"}`, fontSize: 9 },
                { text: `Payment Terms: ${(order?.payment_terms as string) ?? "—"}`, fontSize: 9 },
                { text: `Destination: ${(order?.destination_port as string) ?? "—"}`, fontSize: 9 },
              ],
            },
          ],
          margin: [0, 0, 0, 20],
        },

        // ── Line items table ───────────────────────────────────────────────
        {
          table: {
            headerRows: 1,
            widths: ["*", 80, 90, 90],
            body: [
              // Header row
              [
                { text: "DESCRIPTION", style: "tableHeader" },
                { text: "QTY (KG)",    style: "tableHeader", alignment: "right" },
                { text: "RATE (USD/KG)", style: "tableHeader", alignment: "right" },
                { text: "AMOUNT (USD)", style: "tableHeader", alignment: "right" },
              ],
              // Data row
              [
                { text: (order?.product as string) ?? "Moringa Product", margin: [0, 6, 0, 6] },
                {
                  text: order?.quantity_kg != null
                    ? Number(order.quantity_kg).toLocaleString()
                    : "—",
                  alignment: "right", margin: [0, 6, 0, 6],
                },
                {
                  text: order?.fob_price_usd != null
                    ? `$${Number(order.fob_price_usd).toFixed(4)}`
                    : "—",
                  alignment: "right", margin: [0, 6, 0, 6],
                },
                {
                  text: order?.total_value_usd != null
                    ? fmtUSD(Number(order.total_value_usd))
                    : "—",
                  alignment: "right", bold: true, margin: [0, 6, 0, 6],
                },
              ],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? "#2D6A4F" : null,
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
          },
          margin: [0, 0, 0, 16],
        },

        // ── Totals ─────────────────────────────────────────────────────────
        {
          alignment: "right",
          stack: [
            {
              columns: [
                { text: "Subtotal:", width: 100, alignment: "right", color: "#6b7280" },
                { text: fmtUSD(Number(inv.subtotal_usd ?? 0)), width: 100, alignment: "right" },
              ],
              margin: [0, 0, 0, 4],
            },
            {
              columns: [
                { text: "Tax / Charges:", width: 100, alignment: "right", color: "#6b7280" },
                { text: fmtUSD(Number(inv.tax_amount ?? 0)), width: 100, alignment: "right" },
              ],
              margin: [0, 0, 0, 4],
            },
            { canvas: [{ type: "line", x1: 315, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 4, 0, 6] },
            {
              columns: [
                { text: "TOTAL DUE:", width: 100, alignment: "right", bold: true, fontSize: 12, color: "#047857" },
                { text: fmtUSD(Number(inv.total_usd ?? 0)), width: 100, alignment: "right", bold: true, fontSize: 12, color: "#047857" },
              ],
            },
          ],
          margin: [0, 0, 0, 24],
        },

        // ── Bank details ───────────────────────────────────────────────────
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 12] },
        { text: "BANK DETAILS", style: "sectionLabel", margin: [0, 0, 0, 6] },
        {
          columns: [
            {
              stack: [
                { text: "Bank Name: HDFC Bank Ltd", fontSize: 9 },
                { text: "Account Name: Brindari Exports Pvt Ltd", fontSize: 9, margin: [0, 2, 0, 0] },
                { text: "Account No: XXXX-XXXX-XXXX", fontSize: 9, margin: [0, 2, 0, 0] },
              ],
            },
            {
              stack: [
                { text: "IFSC Code: HDFC0000000", fontSize: 9 },
                { text: "SWIFT Code: HDFCINBBXXX", fontSize: 9, margin: [0, 2, 0, 0] },
                { text: "Branch: Chennai Main Branch", fontSize: 9, margin: [0, 2, 0, 0] },
              ],
            },
          ],
        },
      ],

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Invoice ${inv.invoice_number} | brindari.com`, fontSize: 8, color: "#9ca3af", margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: "#9ca3af", alignment: "right", margin: [0, 0, 40, 0] },
        ],
        margin: [0, 10, 0, 0],
      }),

      styles: {
        brand:        { fontSize: 22, bold: true, color: "#047857" },
        invoiceTitle: { fontSize: 11, bold: true, color: "#374151", letterSpacing: 2 },
        sectionLabel: { fontSize: 8, bold: true, color: "#9ca3af", letterSpacing: 1 },
        tableHeader:  { bold: true, color: "#ffffff", fontSize: 9, margin: [0, 6, 0, 6] },
      },
    };

    return NextResponse.json({ success: true, docDefinition, invoice_number: inv.invoice_number });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
