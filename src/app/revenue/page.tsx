"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatUSD, cn } from "@/lib/utils";
import type { Order, Lead } from "@/lib/supabase";

// ── Constants ──────────────────────────────────────────────────────────────────
const MONTHS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS  = ["#2D6A4F","#40916C","#52B788","#74C69D","#95D5B2","#B7E4C7"];
const YEAR    = new Date().getFullYear();

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtK(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </span>
          <span className="font-medium text-gray-900">{formatUSD(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-gray-400">
      {label}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const supabase = createClient();
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    if (typeof window !== "undefined") return Number(localStorage.getItem("brindari_monthly_target") ?? 50000);
    return 50000;
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [{ data: ordersData, error: oErr }, { data: leadsData, error: lErr }] =
        await Promise.all([
          supabase.from("orders").select("*").neq("status", "cancelled"),
          supabase.from("leads").select("id, status"),
        ]);
      if (oErr || lErr) { setError((oErr ?? lErr)!.message); setLoading(false); return; }
      setOrders((ordersData ?? []) as Order[]);
      setLeads((leadsData ?? []) as Lead[]);
      setLoading(false);
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const revenue  = orders.filter(o => o.payment_status === "paid")
                           .reduce((s, o) => s + o.total_value_usd, 0);
    const pipeline = orders.filter(o => o.payment_status !== "paid")
                           .reduce((s, o) => s + o.total_value_usd, 0);
    const converted = leads.filter(l => l.status === "closed").length;
    const convPct   = leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) : "0.0";
    return { revenue, pipeline, total: orders.length, convPct, convertedLeads: converted };
  }, [orders, leads]);

  // ── Monthly area/bar data (current year) ──────────────────────────────────
  const monthlyData = useMemo(() => {
    const buckets = MONTHS.map((m) => ({
      month: m, revenue: 0, pipeline: 0, orders: 0,
    }));
    orders.forEach((o) => {
      const d = new Date(o.created_at);
      if (d.getFullYear() !== YEAR) return;
      const idx = d.getMonth();
      if (o.payment_status === "paid") buckets[idx].revenue  += o.total_value_usd;
      else                             buckets[idx].pipeline += o.total_value_usd;
      buckets[idx].orders += 1;
    });
    return buckets;
  }, [orders]);

  const hasMonthlyData = monthlyData.some((d) => d.revenue > 0 || d.pipeline > 0);
  const hasOrderData   = monthlyData.some((d) => d.orders > 0);

  // ── Revenue by product ─────────────────────────────────────────────────────
  const productData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      map[o.product] = (map[o.product] ?? 0) + o.total_value_usd;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [orders]);

  // ── Revenue by destination (top 6) ────────────────────────────────────────
  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const dest = o.destination_port?.trim() || "Unknown";
      map[dest] = (map[dest] ?? 0) + o.total_value_usd;
    });
    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    return sorted.map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
    }));
  }, [orders]);

  const maxCountry = countryData[0]?.value ?? 1;

  // ── Pie label ──────────────────────────────────────────────────────────────
  function renderPieLabel(props: {
    cx?: number; cy?: number; midAngle?: number;
    innerRadius?: number; outerRadius?: number; percent?: number;
  }) {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r  = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x  = cx + r * Math.cos(-midAngle * RADIAN);
    const y  = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
        <div className="card h-72 animate-pulse bg-gray-100" />
        <div className="grid grid-cols-2 gap-6">
          <div className="card h-64 animate-pulse bg-gray-100" />
          <div className="card h-64 animate-pulse bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="mt-0.5 text-sm text-gray-500">{YEAR} performance overview</p>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          title="Revenue Collected"
          value={formatUSD(kpi.revenue)}
          sub="from paid orders"
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          title="Pipeline Value"
          value={formatUSD(kpi.pipeline)}
          sub="awaiting payment"
          icon={TrendingUp}
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          title="Total Orders"
          value={kpi.total}
          sub="non-cancelled"
          icon={ShoppingCart}
          color="bg-purple-100 text-purple-600"
        />
        <KpiCard
          title="Lead Conversion"
          value={`${kpi.convPct}%`}
          sub={`${kpi.convertedLeads} of ${leads.length} leads closed`}
          icon={Users}
          color="bg-orange-100 text-orange-600"
        />
      </div>

      {/* ── Monthly target progress ───────────────────────────────────────── */}
      {(() => {
        const thisMonthRevenue = orders
          .filter(o => {
            const d = new Date(o.created_at);
            return o.payment_status === "paid" && d.getMonth() === new Date().getMonth() && d.getFullYear() === YEAR;
          })
          .reduce((s, o) => s + o.total_value_usd, 0);
        const pct = Math.min((thisMonthRevenue / monthlyTarget) * 100, 100);
        const color = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 30 ? "bg-amber-500" : "bg-red-400";
        return (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Monthly Revenue Target</h2>
                <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleString("default", { month: "long", year: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{formatUSD(thisMonthRevenue)}</span>
                <span className="text-xs text-gray-400">of</span>
                <input
                  type="number" min="1000" step="1000"
                  className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold text-center text-gray-700 focus:border-emerald-500 focus:outline-none"
                  value={monthlyTarget}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setMonthlyTarget(v);
                    if (typeof window !== "undefined") localStorage.setItem("brindari_monthly_target", String(v));
                  }}
                />
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-gray-400">
              <span>{pct.toFixed(0)}% of target</span>
              <span>{formatUSD(Math.max(monthlyTarget - thisMonthRevenue, 0))} to go</span>
            </div>
          </div>
        );
      })()}

      {/* ── Area chart: monthly revenue vs pipeline ────────────────────────── */}
      <div className="card">
        <SectionHeader
          title="Monthly Revenue vs Pipeline"
          sub={`Jan – Dec ${YEAR}`}
        />
        <div className="p-5">
          {!hasMonthlyData ? (
            <Empty label="No order data for this year yet." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#047857" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradPipeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6ee7b7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6ee7b7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Area
                  type="monotone" dataKey="revenue" name="Revenue (paid)"
                  stroke="#047857" strokeWidth={2}
                  fill="url(#gradRevenue)" activeDot={{ r: 4, fill: "#047857" }}
                />
                <Area
                  type="monotone" dataKey="pipeline" name="Pipeline"
                  stroke="#6ee7b7" strokeWidth={2}
                  fill="url(#gradPipeline)" activeDot={{ r: 4, fill: "#6ee7b7" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Second row: bar chart + pie chart ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Orders per month bar chart */}
        <div className="card">
          <SectionHeader title="Orders per Month" sub={`${YEAR} order volume`} />
          <div className="p-5">
            {!hasOrderData ? (
              <Empty label="No orders this year yet." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "#f0fdf4" }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(v) => [v as number, "Orders"]}
                  />
                  <Bar dataKey="orders" name="Orders" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue by product pie chart */}
        <div className="card">
          <SectionHeader title="Revenue by Product" sub="total value per product line" />
          <div className="p-5">
            {productData.length === 0 ? (
              <Empty label="No product data yet." />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie
                      data={productData}
                      cx="50%" cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {productData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      formatter={(v) => [formatUSD(v as number), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {productData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-700">{d.name}</p>
                        <p className="text-xs text-gray-400">{formatUSD(d.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Revenue by destination ─────────────────────────────────────────── */}
      <div className="card">
        <SectionHeader title="Revenue by Destination" sub="top 6 destination ports by order value" />
        <div className="p-5">
          {countryData.length === 0 ? (
            <Empty label="No destination data yet. Add destination ports to your orders." />
          ) : (
            <div className="space-y-3">
              {countryData.map((d, i) => (
                <div key={d.name} className="grid grid-cols-[1fr_auto] items-center gap-4">
                  {/* Label + bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{d.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{d.pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(d.value / maxCountry) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  {/* Value */}
                  <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                    {formatUSD(d.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Buyers ────────────────────────────────────────────────────────── */}
      {(() => {
        const buyerMap: Record<string, { value: number; count: number }> = {};
        orders.forEach(o => {
          const id = o.buyer_id;
          if (!buyerMap[id]) buyerMap[id] = { value: 0, count: 0 };
          buyerMap[id].value += o.total_value_usd;
          buyerMap[id].count += 1;
        });
        const top = Object.entries(buyerMap).sort((a, b) => b[1].value - a[1].value).slice(0, 5);
        const maxVal = top[0]?.[1].value ?? 1;
        if (!top.length) return null;
        return (
          <div className="card">
            <SectionHeader title="Top Buyers by Revenue" sub="all-time order value" />
            <div className="p-5 space-y-3">
              {top.map(([buyerId, data], i) => (
                <div key={buyerId} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-gray-400 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate">{buyerId.slice(0, 8)}…</span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{data.count} order{data.count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(data.value / maxVal) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums w-24 text-right shrink-0">{formatUSD(data.value)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
