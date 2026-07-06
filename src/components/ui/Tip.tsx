"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface Props {
  content: string;
  wide?: boolean;
}

/**
 * Lightweight inline tooltip — place next to any label.
 * Usage: <Tip content="Free On Board — seller delivers to export port" />
 */
export function Tip({ content, wide }: Props) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-emerald-600 cursor-help transition-colors" />
      {show && (
        <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl
          ${wide ? "w-64" : "w-52"} text-center leading-relaxed`}>
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

// ── Pre-built tips for common industry terms ───────────────────────────────────
export const TIPS = {
  FOB:          "Free On Board — seller delivers goods to the export port. Buyer pays ocean freight & insurance from there.",
  CIF:          "Cost, Insurance & Freight — seller pays freight + insurance to buyer's destination port.",
  EXW:          "Ex Works — buyer collects from seller's factory. Buyer handles all transport costs.",
  CFR:          "Cost & Freight — seller pays freight to destination port, buyer handles insurance.",
  DAP:          "Delivered At Place — seller delivers to buyer's named location, buyer handles import customs.",
  MOQ:          "Minimum Order Quantity — the smallest quantity a supplier will process or ship in one order.",
  HSCode:       "HS Code (Harmonized System) — 6-digit international code classifying the product for customs. Moringa powder = 1209.99 / 2106.90",
  FSSAI:        "Food Safety & Standards Authority of India — mandatory food safety license for all Indian food exporters.",
  HACCP:        "Hazard Analysis Critical Control Points — international food safety management certification.",
  ISO22000:     "ISO 22000 — international food safety management system standard, required by EU/US importers.",
  Incoterm:     "International Commercial Terms — standardized trade rules defining who pays for shipping, insurance & customs.",
  LeadScore:    "0–100 score indicating how likely this lead is to convert. 70+ = high priority, follow up soon.",
  DealValue:    "Estimated total order value in USD if this lead converts to a buyer.",
  PaymentTerms: "Agreed payment schedule, e.g. '30% advance, 70% against Bill of Lading'.",
  BL:           "Bill of Lading — shipping document proving goods were loaded on the vessel. Required for payment release.",
  COO:          "Certificate of Origin — official document proving the goods were produced in India.",
  Phyto:        "Phytosanitary Certificate — issued by NPPO (National Plant Protection Organization), required for plant-based exports.",
  FOBCalc:      "FOB = Ex-Works + Inland Freight + Export Charges. This is the price at India's export port.",
  ARR:          "Annual Recurring Revenue — total yearly revenue if current monthly pace continues.",
  MRR:          "Monthly Recurring Revenue — monthly revenue from active orders.",
};
