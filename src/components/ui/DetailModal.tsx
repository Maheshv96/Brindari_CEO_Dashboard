"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface DetailField {
  label: string;
  value: React.ReactNode;
  wide?: boolean;       // span full width
  highlight?: boolean;  // emerald accent
}

interface Props {
  title: string;
  subtitle?: string;
  badge?: { label: string; className: string };
  fields: DetailField[];
  actions?: React.ReactNode;  // buttons shown at the bottom
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DetailModal({ title, subtitle, badge, fields, actions, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Slide-in drawer */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
              {badge && (
                <span className={cn("badge shrink-0", badge.className)}>{badge.label}</span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {fields.map((f, i) => (
              <div key={i} className={f.wide ? "col-span-2" : "col-span-1"}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
                  {f.label}
                </dt>
                <dd className={cn(
                  "text-sm text-gray-900 break-words",
                  f.highlight && "font-semibold text-emerald-700"
                )}>
                  {f.value ?? <span className="text-gray-300">—</span>}
                </dd>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4 flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
