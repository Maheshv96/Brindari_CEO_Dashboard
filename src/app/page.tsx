"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, ShoppingCart, DollarSign, FileText, Ship,
  Calculator, Mail, ArrowRight, TrendingUp,
  AlertTriangle, Clock, Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatUSD, STATUS_COLORS, cn } from "@/lib/utils";
import type { Lead, Order, Invoice } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type RecentOrder = Order & { buyers: { company: string } | null };

function computeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, href, color, trend }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; href: string; color: string; trend?: string;
}) {
  return (
    <Link href={href} className="card p-5 hover:shadow-md transition-shadow block group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          {trend && <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

// ── Attention card ────────────────────────────────────────────────────────────
function AttentionItem({ icon: Icon, iconColor, label, value, href, urgent }: {
  icon: React.ElementType; iconColor: string; label: string;
  value: string; href: string; urgent?: boolean;
}) {
  return (
    <Link href={href} className={cn(
      "flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:opacity-90",
      urgent ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
    )}>
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className={cn("text-sm font-medium", urgent ? "text-red-800" : "text-amber-800")}>{label}</span>
      </div>
      <span className={cn("text-sm font-bold", urgent ? "text-red-700" : "text-amber-700")}>{value}</span>
    </Link>
  );
}

// ── Pipeline funnel ───────────────────────────────────────────────────────────
function PipelineFunnel({ leads }: { leads: Lead[] }) {
  const stages = [
    { key: "new",         label: "New",         color: "bg-blue-400"    },
    { key: "contacted",   label: "Contacted",   color: "bg-indigo-400"  },
    { key: "qualified",   label: "Qualified",   color: "bg-purple-400"  },
    { key: "negotiating", label: "Negotiating", color: "bg-orange-400"  },
    { key: "closed",      label: "Closed",      color: "bg-emerald-500" },
  ];
  const max = Math.max(...stages.map(s => leads.filter(l => l.status === s.key).length), 1);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Lead Pipeline</h2>
        <Link href="/leads" className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {stages.map(s => {
          const count = leads.filter(l => l.status === s.key).length;
          const value = leads.filter(l => l.status === s.key).reduce((sum, l) => sum + (l.deal_value_usd ?? 0), 0);
          const pct   = Math.round((count / max) * 100);
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-20 text-xs text-gray-500 text-right shrink-0">{s.label}</span>
              <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={cn("h-full rounded-lg flex items-center px-2.5 transition-all duration-500", s.color)}
                  style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                >
                  {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                </div>
              </div>
              <span className="w-20 text-xs text-gray-400 shrink-0">{value > 0 ? formatUSD(value) : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Revenue trend mini chart (pure CSS sparkline) ─────────────────────────────
function RevenueTrend({ orders }: { orders: Order[] }) {
  const months = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleString("default", { month: "short" }),
        revenue: 0,
      };
    });
    orders.forEach(o => {
      const d   = new Date(o.created_at);
      const idx = 5 - (now.getMonth() - d.getMonth() + 12 * (now.getFullYear() - d.getFullYear()));
      if (idx >= 0 && idx < 6 && o.payment_status === "paid") buckets[idx].revenue += o.total_value_usd;
    });
    return buckets;
  }, [orders]);

  const max = Math.max(...months.map(m => m.revenue), 1);

  return (
    <div className="flex items-end gap-1 h-10">
      {months.map((m, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full rounded-sm bg-emerald-400 transition-all duration-500"
            style={{ height: `${Math.max((m.revenue / max) * 36, m.revenue > 0 ? 4 : 2)}px` }}
            title={`${m.label}: ${formatUSD(m.revenue)}`}
          />
          <span className="text-[9px] text-gray-300">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const supabase = createClient();

  const [greeting, setGreeting] = useState(computeGreeting());
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [orders,   setOrders]   = useState<RecentOrder[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const tick = () => setGreeting(computeGreeting());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchAll() {
      const [
        { data: leadsData },
        { data: ordersData },
        { data: allOrdersData },
        { data: invoicesData },
      ] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*, buyers(company)").order("created_at", { ascending: false }).limit(5),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      ]);
      setLeads((leadsData ?? []) as Lead[]);
      setOrders((ordersData ?? []) as RecentOrder[]);
      setAllOrders((allOrdersData ?? []) as Order[]);
      setInvoices((invoicesData ?? []) as Invoice[]);
      setLoading(false);
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const activeOrders   = allOrders.filter(o => !["delivered","cancelled"].includes(o.status));
    const paidRevenue    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total_usd, 0);
    const pendingInvoices= invoices.filter(i => ["sent","overdue"].includes(i.status));
    const overdueInvoices= invoices.filter(i => i.status === "overdue");
    const inTransit      = allOrders.filter(o => o.status === "in-transit");
    const staleLeads     = leads.filter(l => {
      if (!["new","contacted"].includes(l.status)) return false;
      const days = (Date.now() - new Date(l.created_at).getTime()) / 86400000;
      return days > 7;
    });
    const qualifiedLeads = leads.filter(l => ["qualified","negotiating"].includes(l.status));

    return {
      totalLeads: leads.length,
      qualifiedLeads: qualifiedLeads.length,
      activeOrders: activeOrders.length,
      paidRevenue,
      pendingValue: pendingInvoices.reduce((s, i) => s + i.total_usd, 0),
      overdueCount: overdueInvoices.length,
      inTransit: inTransit.length,
      staleLeads: staleLeads.length,
      pendingCount: pendingInvoices.length,
    };
  }, [leads, allOrders, invoices]);

  const hasAttention = kpi.overdueCount > 0 || kpi.staleLeads > 0 || kpi.pendingCount > 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-28 animate-pulse bg-gray-100" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="card h-64 animate-pulse bg-gray-100" />
          <div className="card h-64 animate-pulse bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, Mahesh 👋</h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s your business snapshot — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {kpi.overdueCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> {kpi.overdueCount} overdue invoice{kpi.overdueCount > 1 ? "s" : ""}
            </span>
          )}
          {kpi.staleLeads > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <Clock className="h-3.5 w-3.5" /> {kpi.staleLeads} lead{kpi.staleLeads > 1 ? "s" : ""} need follow-up
            </span>
          )}
        </div>
      </div>

      {/* Today's Attention */}
      {hasAttention && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-500" /> Needs your attention today
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {kpi.overdueCount > 0 && (
              <AttentionItem urgent icon={AlertTriangle} iconColor="text-red-600"
                label="Overdue invoices" value={`${kpi.overdueCount} unpaid`} href="/invoices" />
            )}
            {kpi.staleLeads > 0 && (
              <AttentionItem icon={Clock} iconColor="text-amber-600"
                label="Leads not contacted 7d+" value={`${kpi.staleLeads} leads`} href="/leads" />
            )}
            {kpi.pendingCount > 0 && kpi.overdueCount === 0 && (
              <AttentionItem icon={FileText} iconColor="text-amber-600"
                label="Invoices awaiting payment" value={formatUSD(kpi.pendingValue)} href="/invoices" />
            )}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard title="Total Leads" value={kpi.totalLeads}
          sub={`${kpi.qualifiedLeads} qualified`} icon={Users} href="/leads"
          color="bg-blue-100 text-blue-600" />
        <KpiCard title="Active Orders" value={kpi.activeOrders}
          icon={ShoppingCart} href="/orders"
          color="bg-emerald-100 text-emerald-600" />
        <KpiCard title="Revenue Collected" value={formatUSD(kpi.paidRevenue)}
          sub="all time" icon={DollarSign} href="/revenue"
          color="bg-green-100 text-green-600" />
        <KpiCard title="Pending Invoices"
          value={kpi.pendingCount}
          sub={formatUSD(kpi.pendingValue)}
          icon={FileText} href="/invoices"
          color={kpi.overdueCount > 0 ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"} />
        <KpiCard title="In Transit" value={kpi.inTransit}
          sub="shipments" icon={Ship} href="/shipments"
          color="bg-purple-100 text-purple-600" />
      </div>

      {/* Pipeline + Revenue trend side by side */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PipelineFunnel leads={leads} />

        {/* Revenue trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Revenue Trend</h2>
            <Link href="/revenue" className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
              Full report <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RevenueTrend orders={allOrders} />
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Last 6 months (paid invoices)</span>
            <span className="font-semibold text-gray-900">{formatUSD(kpi.paidRevenue)} total</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/leads?action=new",   icon: Users,       label: "Add Lead",        color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
            { href: "/orders?action=new",  icon: ShoppingCart,label: "New Order",       color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" },
            { href: "/invoices?action=new",icon: FileText,    label: "New Invoice",     color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200" },
            { href: "/emails?action=new",  icon: Mail,        label: "Campaign",        color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" },
            { href: "/calculator",         icon: Calculator,  label: "FOB Calc",        color: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200" },
            { href: "/revenue",            icon: TrendingUp,  label: "Revenue",         color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link key={href} href={href}
              className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-xs font-semibold transition-colors", color)}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Leads</h2>
            <Link href="/leads" className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {leads.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No leads yet. <Link href="/leads?action=new" className="text-emerald-700 hover:underline">Add your first lead →</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {leads.slice(0, 5).map(lead => {
                const stale = ["new","contacted"].includes(lead.status) &&
                  (Date.now() - new Date(lead.created_at).getTime()) / 86400000 > 7;
                return (
                  <div key={lead.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{lead.company}</p>
                        {stale && <span title="No contact in 7+ days"><Clock className="h-3 w-3 text-amber-400 shrink-0" /></span>}
                      </div>
                      <p className="text-xs text-gray-400">{lead.contact_name} · {lead.country}</p>
                    </div>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      {lead.deal_value_usd != null && <span className="text-xs font-medium text-gray-700">{formatUSD(lead.deal_value_usd)}</span>}
                      <span className={cn("badge", STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600")}>
                        {lead.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/orders" className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No orders yet. <Link href="/orders?action=new" className="text-emerald-700 hover:underline">Create first order →</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map(order => (
                <div key={order.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-mono font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-400">{order.buyers?.company ?? "—"} · {order.product}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-gray-900">{formatUSD(order.total_value_usd)}</span>
                    <span className={cn("badge", STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600")}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
