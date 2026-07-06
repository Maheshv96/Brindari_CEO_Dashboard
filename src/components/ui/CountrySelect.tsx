"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { COUNTRIES } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allowAll?: boolean;        // shows "All countries" as first option
  allLabel?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select country…",
  allowAll = false,
  allLabel = "All countries",
  className,
  required,
  disabled,
}: Props) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");
  const [cursor, setCursor] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const options = [
    ...(allowAll ? [allLabel] : []),
    ...COUNTRIES,
  ];

  const filtered = query.trim()
    ? options.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : options;

  const display = allowAll && value === "" ? allLabel : value || "";

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setCursor(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return;
    const item = listRef.current.children[cursor] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "Enter" || e.key === " ") setOpen(true); return; }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setCursor(c => Math.min(c + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (cursor >= 0 && filtered[cursor]) select(filtered[cursor]);
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        setCursor(-1);
        break;
    }
  }

  function select(country: string) {
    onChange(country === allLabel ? "" : country);
    setOpen(false);
    setQuery("");
    setCursor(-1);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-sm text-left",
          "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
          "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50",
          open && "border-emerald-500 ring-2 ring-emerald-500/20"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={display ? "text-gray-900" : "text-gray-400"}>
          {display || placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          {value && !allowAll && (
            <span onClick={clear} className="rounded p-0.5 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Hidden input for form validation */}
      {required && <input tabIndex={-1} required value={value} onChange={() => {}} className="sr-only" />}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Search box */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Type to filter…"
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setCursor(-1); inputRef.current?.focus(); }}
                className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No countries match &ldquo;{query}&rdquo;</li>
            ) : (
              filtered.map((country, i) => (
                <li
                  key={country}
                  role="option"
                  aria-selected={country === display}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => select(country)}
                  className={cn(
                    "flex cursor-pointer items-center px-3 py-2 text-sm",
                    cursor === i       && "bg-emerald-50 text-emerald-800",
                    country === display && cursor !== i && "font-medium text-emerald-700",
                    cursor !== i && country !== display && "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {country}
                  {country === display && (
                    <span className="ml-auto text-emerald-600">✓</span>
                  )}
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-gray-100 px-3 py-1.5">
            <p className="text-xs text-gray-400">{filtered.length} of {options.length} countries</p>
          </div>
        </div>
      )}
    </div>
  );
}
