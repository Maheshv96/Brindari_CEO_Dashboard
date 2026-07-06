"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  options:     string[];
  value:       string[];
  onChange:    (val: string[]) => void;
  placeholder?: string;
  max?:        number;      // max selections (undefined = unlimited)
  className?:  string;
  disabled?:   boolean;
}

export function MultiSelect({
  options, value, onChange,
  placeholder = "Select…", max, className, disabled,
}: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, opt]);
    }
  }

  function remove(opt: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(value.filter(v => v !== opt));
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <div
        onClick={() => !disabled && setOpen(o => !o)}
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 cursor-pointer",
          "focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20",
          disabled && "cursor-not-allowed bg-gray-50 opacity-50",
          open && "border-emerald-500 ring-2 ring-emerald-500/20"
        )}
      >
        {/* Selected chips */}
        {value.map(v => (
          <span key={v} className="flex items-center gap-1 rounded-md bg-emerald-100 pl-2 pr-1 py-0.5 text-xs font-medium text-emerald-800">
            {v}
            <button onClick={e => remove(v, e)} className="rounded text-emerald-600 hover:text-emerald-900 hover:bg-emerald-200 p-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Placeholder */}
        {value.length === 0 && (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}

        <span className="ml-auto shrink-0">
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Hint */}
          {max && (
            <p className="px-3 py-1 text-[10px] text-gray-400">
              {value.length}/{max} selected
            </p>
          )}

          {/* Options */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No options match</li>
            ) : filtered.map(opt => {
              const selected  = value.includes(opt);
              const maxed     = !selected && max != null && value.length >= max;
              return (
                <li key={opt}
                  onClick={() => !maxed && toggle(opt)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm cursor-pointer",
                    selected  ? "bg-emerald-50 text-emerald-800 font-medium" : "text-gray-700 hover:bg-gray-50",
                    maxed     && "opacity-40 cursor-not-allowed"
                  )}>
                  {opt}
                  {selected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5">
            <p className="text-[10px] text-gray-400">{filtered.length} of {options.length}</p>
            {value.length > 0 && (
              <button onClick={() => onChange([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
