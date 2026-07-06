"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, UserCheck, ShoppingCart,
  TrendingUp, FileText, Ship, FolderOpen, Calculator,
  Factory, Mail, ExternalLink, LogOut, Telescope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrindariLogo } from "@/components/ui/BrindariLogo";
import { createClient } from "@/lib/supabase";

// ── Grouped navigation ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/",        label: "Dashboard",       icon: LayoutDashboard },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/leads",   label: "Leads",           icon: Users           },
      { href: "/buyers",  label: "Buyers",          icon: UserCheck       },
      { href: "/emails",  label: "Email Campaigns", icon: Mail            },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/orders",     label: "Orders",       icon: ShoppingCart    },
      { href: "/shipments",  label: "Shipments",    icon: Ship            },
      { href: "/documents",  label: "Documents",    icon: FolderOpen      },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices",   label: "Invoices",     icon: FileText        },
      { href: "/revenue",    label: "Revenue",      icon: TrendingUp      },
      { href: "/calculator", label: "FOB Calculator",icon: Calculator     },
    ],
  },
  {
    label: "Sourcing",
    items: [
      { href: "/suppliers",          label: "Suppliers",          icon: Factory    },
      { href: "/suppliers/discover", label: "Discover Suppliers", icon: Telescope  },
    ],
  },
];

// ── Badge types ───────────────────────────────────────────────────────────────
type Badges = {
  leads:     number;
  orders:    number;
  invoices:  number;
  shipments: number;
  emails:    number;
};

const BADGE_MAP: Record<string, keyof Badges> = {
  "/leads":    "leads",
  "/orders":   "orders",
  "/invoices": "invoices",
  "/shipments":"shipments",
  "/emails":   "emails",
};

export function Sidebar() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ leads: 0, orders: 0, invoices: 0, shipments: 0, emails: 0 });

  // Fetch live badge counts every 60 seconds
  useEffect(() => {
    const supabase = createClient();

    async function fetchBadges() {
      const [
        { count: newLeads },
        { count: activeOrders },
        { count: overdueInvoices },
        { count: inTransit },
        { count: draftCampaigns },
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true })
          .in("status", ["new", "contacted"]),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .not("status", "in", '("delivered","cancelled")'),
        supabase.from("invoices").select("*", { count: "exact", head: true })
          .in("status", ["overdue", "sent"]),
        supabase.from("shipments").select("*", { count: "exact", head: true })
          .eq("tag", "InTransit"),
        supabase.from("email_campaigns").select("*", { count: "exact", head: true })
          .eq("status", "active"),
      ]);

      setBadges({
        leads:     newLeads     ?? 0,
        orders:    activeOrders ?? 0,
        invoices:  overdueInvoices ?? 0,
        shipments: inTransit    ?? 0,
        emails:    draftCampaigns ?? 0,
      });
    }

    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-emerald-900">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-emerald-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/60">
          <BrindariLogo size={30} />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight tracking-wide">Brindari</p>
          <p className="text-xs text-emerald-400">CEO Dashboard</p>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                const badgeKey = BADGE_MAP[href];
                const badgeCount = badgeKey ? badges[badgeKey] : 0;

                return (
                  <Link key={href} href={href}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-emerald-700 text-white"
                        : "text-emerald-200 hover:bg-emerald-800 hover:text-white"
                    )}>
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </span>
                    {badgeCount > 0 && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[18px] text-center",
                        href === "/invoices"
                          ? "bg-red-500 text-white"
                          : isActive
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-800 text-emerald-300"
                      )}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-emerald-800 px-3 py-3 space-y-0.5">
        <a href="/portal" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-800 hover:text-white transition-colors">
          <ExternalLink className="h-4 w-4 shrink-0" />
          Preview Portal ↗
        </a>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-800 hover:text-white transition-colors"
          onClick={() => {}}>
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
