"use client";

import { useEffect, useState } from "react";
import { PackageCheck, FileText, Ship, FolderOpen, Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatUSD } from "@/lib/utils";
import { BrindariLogo } from "@/components/ui/BrindariLogo";
import type { Order, Invoice } from "@/lib/supabase";

type PortalBuyer = {
  id: string;
  company: string;
  contact_name: string;
  country: string;
  portal_access: boolean;
};

const FEATURES = [
  { icon: PackageCheck, label: "Order Tracking",    desc: "Live status from confirmed to delivered" },
  { icon: FileText,     label: "Invoices",           desc: "View and download commercial invoices"   },
  { icon: Ship,         label: "Shipment Tracking",  desc: "Real-time tracking for your shipments"   },
  { icon: FolderOpen,   label: "Documents",          desc: "BL, COO, phytosanitary & more"           },
];

export default function PortalPage() {
  const supabase = createClient();

  const [buyer,   setBuyer]   = useState<PortalBuyer | null>(null);
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [invoices,setInvoices]= useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) { setSession(false); setLoading(false); return; }
      setSession(true);

      // Find buyer by auth_user_id
      const { data: buyerRow } = await supabase
        .from("buyers")
        .select("id, company, contact_name, country, portal_access")
        .eq("auth_user_id", s.user.id)
        .single();

      if (!buyerRow) { setLoading(false); return; }
      setBuyer(buyerRow as PortalBuyer);

      // Fetch their orders and invoices in parallel
      const [{ data: ordData }, { data: invData }] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("buyer_id", buyerRow.id)
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("*")
          .eq("buyer_id", buyerRow.id)
          .order("issued_date", { ascending: false })
          .limit(5),
      ]);

      setOrders((ordData ?? []) as Order[]);
      setInvoices((invData ?? []) as Invoice[]);
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  // ── Not logged in — landing / login prompt ─────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900">
        <div className="mx-auto max-w-4xl px-6 py-16">
          {/* Logo */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <BrindariLogo size={34} />
              </div>
              <span className="text-3xl font-bold text-white tracking-tight">Brindari</span>
            </div>
            <h1 className="text-2xl font-semibold text-white">Buyer Portal</h1>
            <p className="mt-2 text-emerald-300">Your dedicated space for orders, invoices &amp; shipment tracking</p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-4 mb-10 sm:grid-cols-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl bg-white/10 backdrop-blur-sm p-5 text-center border border-white/10">
                <Icon className="mx-auto h-7 w-7 text-emerald-300 mb-3" />
                <p className="text-sm font-semibold text-white mb-1">{label}</p>
                <p className="text-xs text-emerald-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Login card */}
          <div className="mx-auto max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mb-4 flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-emerald-50">
              <LogIn className="h-6 w-6 text-emerald-700" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Access your portal</h2>
            <p className="text-sm text-gray-500 mb-6">
              You need an invitation from Brindari to log in.
              Check your email for a magic link, or contact your account manager.
            </p>
            <a
              href="mailto:support@brindari.com"
              className="block w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors text-center"
            >
              Contact Brindari
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── No buyer linked ─────────────────────────────────────────────────────────
  if (!buyer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <BrindariLogo size={48} />
        <h2 className="text-lg font-semibold text-gray-900">Account not linked</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Your login is not linked to a buyer account yet. Please contact Brindari at{" "}
          <a href="mailto:support@brindari.com" className="text-emerald-700 hover:underline">support@brindari.com</a>.
        </p>
      </div>
    );
  }

  // ── Authenticated buyer dashboard ───────────────────────────────────────────
  const outstanding = invoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .reduce((s, i) => s + i.total_usd, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <header className="bg-emerald-900 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrindariLogo size={26} />
            <div>
              <span className="text-sm font-bold text-white">Brindari</span>
              <span className="ml-2 text-xs text-emerald-400">Buyer Portal</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{buyer.company}</p>
            <p className="text-xs text-emerald-400">{buyer.country}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {buyer.contact_name || buyer.company} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Here&apos;s an overview of your account with Brindari.</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Orders",   value: orders.length,          color: "bg-emerald-100 text-emerald-700" },
            { label: "Outstanding",     value: formatUSD(outstanding), color: "bg-orange-100 text-orange-700"   },
            { label: "Total Invoices",  value: invoices.length,         color: "bg-blue-100 text-blue-700"      },
          ].map(k => (
            <div key={k.label} className="card p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
              <p className={`mt-1.5 text-xl font-bold ${k.color.split(" ")[1]}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No orders yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium font-mono text-gray-900">{o.order_number}</p>
                    <p className="text-xs text-gray-400">{o.product} · {Number(o.quantity_kg).toLocaleString()} kg</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{formatUSD(o.total_value_usd)}</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 capitalize">
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No invoices yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium font-mono text-gray-900">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-400">
                      Issued: {inv.issued_date}
                      {inv.due_date && ` · Due: ${inv.due_date}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{formatUSD(inv.total_usd)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      inv.status === "paid"    ? "bg-green-100 text-green-800"  :
                      inv.status === "overdue" ? "bg-red-100 text-red-800"      :
                      inv.status === "sent"    ? "bg-blue-100 text-blue-800"    :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Questions? Email{" "}
          <a href="mailto:support@brindari.com" className="text-emerald-700 hover:underline">support@brindari.com</a>
        </p>
      </div>
    </div>
  );
}
