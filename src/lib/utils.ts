import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Shadcn helper ─────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatters ───────────────────────────────────────────────────────
const fmtUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const fmtINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatUSD(amount: number): string {
  return fmtUSD.format(amount);
}

export function formatINR(amount: number): string {
  return fmtINR.format(amount);
}

// ── Order number: BRD-YYMM-XXXX ──────────────────────────────────────────────
export function generateOrderNumber(): string {
  const now = new Date();
  const yy   = String(now.getFullYear()).slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `BRD-${yy}${mm}-${rand}`;
}

// ── Invoice number: INV-YYYYMM-XXX ───────────────────────────────────────────
export function generateInvoiceNumber(): string {
  const now    = new Date();
  const yyyy   = now.getFullYear();
  const mm     = String(now.getMonth() + 1).padStart(2, "0");
  const rand   = String(Math.floor(100 + Math.random() * 900));
  return `INV-${yyyy}${mm}-${rand}`;
}

// ── Status → Tailwind badge classes ──────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  // Lead statuses
  new:            "bg-blue-100 text-blue-800",
  contacted:      "bg-yellow-100 text-yellow-800",
  qualified:      "bg-purple-100 text-purple-800",
  negotiating:    "bg-orange-100 text-orange-800",
  closed:         "bg-green-100 text-green-800",
  lost:           "bg-red-100 text-red-800",

  // Order statuses
  confirmed:      "bg-blue-100 text-blue-800",
  "in-production":"bg-indigo-100 text-indigo-800",
  "quality-check":"bg-violet-100 text-violet-800",
  "ready-to-ship":"bg-cyan-100 text-cyan-800",
  shipped:        "bg-teal-100 text-teal-800",
  "in-transit":   "bg-sky-100 text-sky-800",
  delivered:      "bg-green-100 text-green-800",
  cancelled:      "bg-gray-100 text-gray-600",

  // Payment statuses
  pending:        "bg-yellow-100 text-yellow-800",
  partial:        "bg-orange-100 text-orange-800",
  paid:           "bg-green-100 text-green-800",
  overdue:        "bg-red-100 text-red-800",

  // Invoice statuses
  draft:          "bg-gray-100 text-gray-700",
  sent:           "bg-blue-100 text-blue-800",

  // Document statuses
  uploaded:       "bg-blue-100 text-blue-800",
  verified:       "bg-green-100 text-green-800",
  shared:         "bg-teal-100 text-teal-800",

  // Campaign statuses
  active:         "bg-green-100 text-green-800",
  paused:         "bg-yellow-100 text-yellow-800",
  completed:      "bg-gray-100 text-gray-600",

  // Email log statuses
  queued:         "bg-gray-100 text-gray-600",
  opened:         "bg-blue-100 text-blue-800",
  replied:        "bg-green-100 text-green-800",
  bounced:        "bg-red-100 text-red-800",
  unsubscribed:   "bg-gray-100 text-gray-500",
};

// ── Target export countries ───────────────────────────────────────────────────
export const COUNTRIES: string[] = [
  "Argentina", "Australia", "Austria", "Bahrain", "Bangladesh", "Belgium",
  "Brazil", "Canada", "Chile", "China", "Colombia", "Czech Republic",
  "Denmark", "Ecuador", "Egypt", "Ethiopia", "Finland", "France",
  "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India",
  "Indonesia", "Ireland", "Israel", "Italy", "Ivory Coast", "Japan",
  "Jordan", "Kenya", "Kuwait", "Malaysia", "Maldives", "Mexico",
  "Morocco", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway",
  "Oman", "Pakistan", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Saudi Arabia", "Senegal", "Singapore", "South Africa",
  "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan",
  "Tanzania", "Thailand", "Tunisia", "Turkey", "Uganda", "United Arab Emirates",
  "United Kingdom", "United States", "Vietnam",
];

// ── Moringa product lines ─────────────────────────────────────────────────────
export const PRODUCTS: string[] = [
  "Moringa Powder",
  "Moringa Capsules",
  "Moringa Oil",
  "Moringa Seeds",
  "Moringa Tea",
  "Moringa Leaf Dried",
];

// ── Incoterms ─────────────────────────────────────────────────────────────────
export const INCOTERMS: string[] = ["FOB", "CIF", "EXW", "CFR", "DAP"];
