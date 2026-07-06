// Shared email HTML builder — used by both send-test and bulk-campaign routes

export const BRAND = {
  name:     "Brindari Global",
  website:  "https://www.brindari.com",
  email:    "sales@brindari.com",
  phone:    "+91 7020400283 / 9404772826",
  teal:     "#0F6E56",
  tealDeep: "#0A5040",
  sage:     "#7BA88A",
};

// ── Origin paragraph (Priority 3) ─────────────────────────────────────────────
export const ORIGIN_PARA = `Sourced from Maharashtra, India — a region with an ideal tropical climate, mineral-rich soil, and year-round growing seasons perfectly suited to moringa cultivation. Our partnerships with local farmers ensure consistent quality and full traceability from farm to shipment. Brindari Global manages the complete export process — processing, quality checks, documentation, and logistics.`;

// ── Certification descriptions (Priority 1) ───────────────────────────────────
export const CERT_DESCRIPTIONS: Record<string, string> = {
  HACCP:        "Food Safety Management",
  FSSAI:        "India Food Safety Authority",
  APEDA:        "Registered Exporter (India)",
  NABL:         "Accredited Lab Testing",
  Organic:      "Certified Organic",
  "ISO 22000":  "Food Safety Management System",
  Halal:        "Halal Certified",
  Kosher:       "Kosher Certified",
  "Non-GMO":    "Non-GMO Verified",
};

// ── Market-specific pricing (Priority 6) ──────────────────────────────────────
export const MARKET_PRICING: Record<string, { fob: number; moq: number; port: string }> = {
  USA:          { fob: 4.80, moq: 500, port: "Mumbai/JNPT" },
  Canada:       { fob: 4.80, moq: 500, port: "Mumbai/JNPT" },
  Germany:      { fob: 4.50, moq: 500, port: "Mumbai/JNPT" },
  France:       { fob: 4.50, moq: 500, port: "Mumbai/JNPT" },
  Netherlands:  { fob: 4.50, moq: 500, port: "Mumbai/JNPT" },
  UK:           { fob: 4.50, moq: 500, port: "Mumbai/JNPT" },
  Australia:    { fob: 4.60, moq: 500, port: "Mumbai/JNPT" },
  UAE:          { fob: 4.20, moq: 300, port: "Mumbai/JNPT" },
  "Saudi Arabia": { fob: 4.20, moq: 300, port: "Mumbai/JNPT" },
  Japan:        { fob: 4.70, moq: 500, port: "Mumbai/JNPT" },
  "South Korea": { fob: 4.70, moq: 500, port: "Mumbai/JNPT" },
};

// ── EmailDetails interface (Priorities 1 & 2) ─────────────────────────────────
export interface EmailDetails {
  product?:           string;
  fob_price?:         string;
  moq?:               string;
  certifications?:    string[];
  sample?:            boolean;
  // Additional product details (Priority 2)
  packaging?:         string;
  lead_time?:         string;
  payment_terms?:     string;
  shelf_life?:        string;
  hs_code?:           string;
  container_loading?: string;
  port?:              string;
  // Controls
  show_docs?:         boolean;  // show documentation list (Priority 4)
  stage?:             number;   // 1=Cold 2=Inquiry 3=Sample 4=Direct 5=Retention
}

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO_URL = process.env.EMAIL_LOGO_URL
  ?? "https://wsrv.nl/?url=brindari.com/assets/logo-icon.svg&output=png&w=160&h=160";

export function headerLogoHtml(): string {
  return `<img src="${LOGO_URL}" width="160" height="40"
    alt="Brindari Global" style="display:block;border:0;"/>`;
}

// Inline CSS logo — fallback when no external image available
export function logoHtml(size: "large" | "small"): string {
  const L   = size === "large";
  const ow  = L ? 13 : 8;
  const oh  = L ? 24 : 15;
  const iw  = L ? 13 : 8;
  const ih  = L ? 36 : 22;
  const sw  = L ? 5  : 3;
  const sh  = L ? 30 : 19;
  const gap = L ? 2  : 1;
  const T   = BRAND.teal;
  const S   = BRAND.sage;

  return `<table cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:${gap}px 0;">
    <tr valign="bottom">
      <td style="width:${ow}px;height:${oh}px;background:${T};border-radius:50%;padding:0;line-height:0;">&nbsp;</td>
      <td style="width:${iw}px;height:${ih}px;background:${T};border-radius:50%;padding:0;line-height:0;">&nbsp;</td>
      <td style="width:${iw}px;height:${ih}px;background:${S};border-radius:50%;padding:0;line-height:0;">&nbsp;</td>
      <td style="width:${ow}px;height:${oh}px;background:${S};border-radius:50%;padding:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td colspan="4" align="center" style="padding-top:3px;">
        <div style="width:${sw}px;height:${sh}px;background:${T};margin:0 auto;border-radius:0 0 3px 3px;"></div>
      </td>
    </tr>
  </table>`;
}

// ── Strip AI sign-offs ────────────────────────────────────────────────────────
export function stripAiExtras(text: string): string {
  return text
    .replace(/\n+(Here are|Key details|Relevant details|Product details)[^]*$/i, "")
    .replace(/\n+[-•*]\s+FOB[^]*$/i,       "")
    .replace(/\n+Best regards[^]*$/i,       "")
    .replace(/\n+Kind regards[^]*$/i,       "")
    .replace(/\n+Regards[,.][^]*$/i,        "")
    .replace(/\n+Sincerely[^]*$/i,         "")
    .replace(/\n+--\s*\n[^]*$/,            "")
    .replace(/\n+Brindari[^]*$/i,          "")
    .trim();
}

// ── Main HTML builder ─────────────────────────────────────────────────────────
// logoSrc: pass "cid:logo-brindari" when sending via Resend (inline attachment)
export function buildEmailHtml(introText: string, details: EmailDetails = {}, logoSrc?: string): string {
  const Lg = logoSrc ?? LOGO_URL;
  const { teal: T, tealDeep: D, sage: S } = BRAND;
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const introParagraphs = introText
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(block =>
      `<p style="margin:0 0 18px 0;line-height:1.8;color:#374151;">${block.trim().replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  // ── Stage-aware visibility rules ────────────────────────────────────────────
  const st = details.stage ?? 1;
  // What each stage shows:
  //  1 Cold      → product, FOB, top-3 certs, sample
  //  2 Inquiry   → everything + docs
  //  3 Sample    → FOB, MOQ, port, payment terms
  //  4 Direct    → nothing (AI asks one question)
  //  5 Retention → product, sample
  const show = {
    product:    [1,2,3,5].includes(st),
    fob:        [1,2,3].includes(st),
    moq:        [2,3].includes(st),
    port:       [2,3].includes(st),
    packaging:  st === 2,
    lead_time:  st === 2,
    payment:    [2,3].includes(st),
    shelf_life: st === 2,
    hs_code:    st === 2,
    container:  st === 2,
    certs:      [1,2].includes(st),
    sample:     [1,2,5].includes(st),
    docs:       st === 2 || !!details.show_docs,
  };

  // Stage CTA closing lines
  const stageCta: Record<number, string> = {
    1: "Happy to share a sample and our full documentation pack on request.",
    2: "Happy to share any of the above as part of your evaluation process.",
    3: "Happy to walk you through the order process and confirm timelines.",
    4: "",
    5: "Happy to make your reorder as smooth as possible.",
  };

  // ── Detail rows ─────────────────────────────────────────────────────────────
  const detailRows: string[] = [];

  if (show.product && details.product) {
    detailRows.push(`<strong style="color:${D};">Product:</strong> ${details.product}`);
  }

  if (show.fob && details.fob_price) {
    detailRows.push(`<strong style="color:${D};">FOB Pricing:</strong> ~$${details.fob_price}/kg &nbsp;<span style="color:#9ca3af;font-size:12px;">— indicative, subject to order specs</span>`);
  }

  if (show.moq && details.moq) {
    detailRows.push(`<strong style="color:${D};">MOQ:</strong> ${details.moq} kg per order`);
  }

  if (show.port && details.port) {
    detailRows.push(`<strong style="color:${D};">Port of Loading:</strong> ${details.port}`);
  }

  if (show.packaging && details.packaging) {
    detailRows.push(`<strong style="color:${D};">Packaging:</strong> ${details.packaging}`);
  }

  if (show.lead_time && details.lead_time) {
    detailRows.push(`<strong style="color:${D};">Lead Time:</strong> ${details.lead_time}`);
  }

  if (show.payment && details.payment_terms) {
    detailRows.push(`<strong style="color:${D};">Payment Terms:</strong> ${details.payment_terms}`);
  }

  if (show.shelf_life && details.shelf_life) {
    detailRows.push(`<strong style="color:${D};">Shelf Life:</strong> ${details.shelf_life}`);
  }

  if (show.hs_code && details.hs_code) {
    detailRows.push(`<strong style="color:${D};">HS Code:</strong> ${details.hs_code}`);
  }

  if (show.container && details.container_loading) {
    detailRows.push(`<strong style="color:${D};">Container Loading:</strong> ${details.container_loading}`);
  }

  // ── Certifications ──────────────────────────────────────────────────────────
  if (show.certs) {
    const certs = details.certifications ?? [];
    // Stage 1: show top 3 only; Stage 2: show all
    const visible = st === 1 ? certs.slice(0, 3) : certs;
    if (visible.length > 0) {
      const bullets = visible.map(cert => {
        const desc = CERT_DESCRIPTIONS[cert];
        // Stage 1: compact inline; Stage 2: full with description
        return st === 1
          ? `<span style="color:${T};font-weight:600;">•</span>&nbsp;<strong style="color:${D};">${cert}</strong>${desc ? ` <span style="color:#6b7280;font-size:12px;">— ${desc}</span>` : ""}&nbsp;&nbsp;`
          : `<div style="padding:2px 0;"><span style="color:${T};font-weight:600;">•</span>&nbsp;<strong style="color:${D};">${cert}</strong>${desc ? ` <span style="color:#6b7280;font-size:12px;">— ${desc}</span>` : ""}</div>`;
      }).join("");
      detailRows.push(
        st === 1
          ? `<strong style="color:${D};">Certifications:</strong> <span style="line-height:2;">${bullets}</span>`
          : `<strong style="color:${D};">Certifications:</strong><div style="margin-top:6px;line-height:1.9;">${bullets}</div>`
      );
    } else {
      detailRows.push(
        `<strong style="color:${D};">Certifications:</strong> <em style="color:#9ca3af;font-size:13px;">HACCP · FSSAI · APEDA · NABL — available on request</em>`
      );
    }
  }

  if (show.sample && details.sample !== false) {
    detailRows.push(`<strong style="color:${D};">Sample Shipment:</strong> Available on request <span style="color:#9ca3af;font-size:12px;">(buyer arranges freight)</span>`);
  }

  const detailsSection = detailRows.length > 0 ? `
    <p style="margin:0 0 10px 0;color:#374151;line-height:1.8;">Here are the key details for your consideration:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
      ${detailRows.map(row => `
        <tr>
          <td style="padding:9px 12px;border-left:3px solid ${T};background:#fafafa;
                     color:#374151;line-height:1.6;font-size:14px;margin-bottom:8px;">
            ${row}
          </td>
        </tr>
        <tr><td style="height:6px;"></td></tr>`).join("")}
    </table>
  ` : "";

  // ── Documentation section ─────────────────────────────────────────────────
  const docsSection = show.docs ? `
    <p style="margin:0 0 10px 0;color:#374151;line-height:1.8;font-weight:600;">Documentation provided with every shipment:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
      ${[
        "Certificate of Analysis (COA)",
        "Phytosanitary Certificate",
        "Certificate of Origin",
        "HACCP / FSSAI Certificates",
        "Packing List &amp; Commercial Invoice",
      ].map(doc => `
        <tr>
          <td style="padding:6px 12px;border-left:3px solid ${S};background:#f9f7f3;
                     color:#374151;font-size:13px;line-height:1.6;">
            <span style="color:${T};">•</span>&nbsp;${doc}
          </td>
        </tr>
        <tr><td style="height:4px;"></td></tr>`).join("")}
    </table>
    <p style="margin:0 0 18px 0;line-height:1.8;color:#374151;">${stageCta[st] ?? stageCta[1]}</p>
  ` : stageCta[st] ? `<p style="margin:0 0 18px 0;line-height:1.8;color:#374151;">${stageCta[st]}</p>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:28px 12px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0"
  style="max-width:620px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;
         box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr><td style="padding:22px 36px 20px;border-bottom:3px solid ${T};">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:14px;width:1%;">
        <img src="${Lg}" width="44" height="44"
          alt="Brindari Global" style="display:block;border:0;"/>
      </td>
      <td valign="middle">
        <div style="font-family:Georgia,'Times New Roman',serif;
                    font-size:22px;font-weight:700;color:${D};
                    letter-spacing:0.3px;line-height:1.1;">Brindari Global</div>
        <div style="font-family:Georgia,'Times New Roman',serif;
                    font-size:10px;font-style:italic;color:${S};
                    letter-spacing:1.8px;margin-top:3px;">Pure. Organic. Global.</div>
      </td>
      <td align="right" valign="middle">
        <span style="font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;">${date}</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:32px 36px 12px;font-size:15px;">
    ${introParagraphs}
    <p style="margin:0 0 20px 0;padding:14px 16px;background:#f9f7f3;
              border-left:3px solid ${S};border-radius:0 6px 6px 0;
              font-size:14px;color:#4b5563;line-height:1.8;font-style:italic;">
      ${ORIGIN_PARA}
    </p>
    ${detailsSection}
    ${docsSection}
  </td></tr>

  <!-- DIVIDER -->
  <tr><td style="padding:0 36px;">
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/>
  </td></tr>

  <!-- SIGNATURE -->
  <tr><td style="padding:22px 36px 28px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:16px;padding-top:2px;">
        <img src="${Lg}" width="36" height="36"
          alt="Brindari Global" style="display:block;border:0;"/>
      </td>
      <td valign="top">
        <div style="font-family:Georgia,'Times New Roman',serif;
                    font-size:14px;font-weight:700;color:${D};
                    letter-spacing:0.3px;line-height:1.2;margin-bottom:2px;">
          Brindari Global
        </div>
        <div style="font-family:Georgia,'Times New Roman',serif;
                    font-size:10px;font-style:italic;color:${S};
                    letter-spacing:1.5px;margin-bottom:10px;">
          Pure. Organic. Global.
        </div>
        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:2.1;">
          <a href="mailto:${BRAND.email}" style="color:${T};text-decoration:none;">📧 ${BRAND.email}</a><br/>
          <a href="${BRAND.website}" style="color:${T};text-decoration:none;">🌐 www.brindari.com</a><br/>
          <span style="color:#6b7280;">📱 ${BRAND.phone}</span>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f9f7f3;padding:12px 36px;border-top:1px solid #e5e7eb;
                 border-radius:0 0 8px 8px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#9ca3af;line-height:1.6;">
      ${BRAND.name} &nbsp;·&nbsp; Maharashtra, India &nbsp;·&nbsp; Organic Moringa &amp; Superfoods &nbsp;·&nbsp;
      <a href="${BRAND.website}" style="color:#9ca3af;">www.brindari.com</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Plain text fallback ───────────────────────────────────────────────────────
export function buildEmailText(introText: string, details: EmailDetails = {}): string {
  const certLine = details.certifications?.length
    ? details.certifications.map(c => {
        const d = CERT_DESCRIPTIONS[c];
        return `  • ${c}${d ? ` — ${d}` : ""}`;
      }).join("\n")
    : "  • HACCP, FSSAI, APEDA, NABL — documentation available on request";

  const extraLines: string[] = [];
  if (details.port)              extraLines.push(`- Port of Loading: ${details.port}`);
  if (details.packaging)         extraLines.push(`- Packaging: ${details.packaging}`);
  if (details.lead_time)         extraLines.push(`- Lead Time: ${details.lead_time}`);
  if (details.payment_terms)     extraLines.push(`- Payment Terms: ${details.payment_terms}`);
  if (details.shelf_life)        extraLines.push(`- Shelf Life: ${details.shelf_life}`);
  if (details.hs_code)           extraLines.push(`- HS Code: ${details.hs_code}`);
  if (details.container_loading) extraLines.push(`- Container Loading: ${details.container_loading}`);

  const docsBlock = details.show_docs ? `
Documentation provided with every shipment:
  • Certificate of Analysis (COA)
  • Phytosanitary Certificate
  • Certificate of Origin
  • HACCP / FSSAI Certificates
  • Packing List & Commercial Invoice
` : "";

  return `${introText}

${ORIGIN_PARA}

Key details:
${details.product    ? `- Product: ${details.product}` : ""}
${details.fob_price  ? `- FOB Pricing: ~$${details.fob_price}/kg (indicative)` : "- FOB Pricing: available on enquiry"}
${details.moq        ? `- MOQ: ${details.moq} kg per order` : ""}
${extraLines.join("\n")}
Certifications:
${certLine}
${details.sample !== false ? "- Sample Shipment: available on request (buyer arranges freight)" : ""}
${docsBlock}
Happy to share spec sheets, lab reports, and certificate copies if useful.

--
${BRAND.name}
Pure. Organic. Global.
📧 ${BRAND.email}
🌐 www.brindari.com
📱 ${BRAND.phone}`.replace(/\n{3,}/g, "\n\n").trim();
}
