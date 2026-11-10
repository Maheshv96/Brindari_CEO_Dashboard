#!/usr/bin/env python3
"""Brindari shared tracker CLI (BRIEF.md section 5).

Agents use this instead of editing the workbook by hand. It only ever ADDS
rows; it never edits or deletes existing ones.

  tracker.py init                         add any missing tracker tabs (idempotent)
  tracker.py tabs                         list tabs and row counts
  tracker.py read  <tab> [--last N]       print a tab's rows as JSON
  tracker.py append <tab> '<json>'        append one row (JSON object) or many (JSON array)
  tracker.py columns <tab>                print the column names a tab expects
  tracker.py read <sheet> --workbook <name> [--last N]
                                          read-only access to another Brindari workbook:
                                          master, contacts, marketing, trademap, actionpack
                                          (no sheet name -> list its sheets)

<tab> is a short name (activity, tasks, approvals, decisions, diversification,
compliance, marketing) or an existing sheet's exact title (e.g. "03 Lead CRM").

Safety:
  - refuses to write while the workbook is open in Excel / LibreOffice / Numbers
  - saves a timestamped backup before every write (keeps the newest 30)
  - writes to a temp file, then swaps it in, so a crash cannot corrupt the file

Workbook path: $TRACKER_PATH, else the path in docs/agents/BRIEF.md section 0.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

DEFAULT_PATH = "/Users/mahesh/Documents/Claude/Projects/Brindari.com/03_Brindari_Operations_Toolkit.xlsx"
IST = timezone(timedelta(hours=5, minutes=30))
HEADER_ROW = 6          # matches the existing toolkit sheets
FIRST_DATA_ROW = 7
KEEP_BACKUPS = 30
FRESH_LOCK_HOURS = 12   # a lock file newer than this means "someone has it open"

# Other Brindari workbooks agents may READ (never write).
SOURCES = {
    "master":     "/Users/mahesh/Downloads/Brindari_Master_v5.xlsx",
    "contacts":   "/Users/mahesh/Desktop/Brindari Global Research/2. Brindari_Buyer_Supplier_Contacts.xlsx",
    "marketing":  "/Users/mahesh/Downloads/Brindari_Marketing_Research_v3.xlsx",
    "trademap":   "/Users/mahesh/Desktop/Brindari Global Research/5. Brindari_TradeMap_Analysis.xlsx",
    "actionpack": "/Users/mahesh/Desktop/Brindari Global Research/4. Brindari_ActionPack.xlsx",
}

TEAL, CREAM, INK, GREY = "FF0F6E56", "FFFAEEDA", "FF1F2937", "FF4B5563"

STATUS = ["not started", "in progress", "blocked", "done"]
YESNO = ["yes", "no"]

# short name -> (sheet title, subtitle, note, [(column, allowed values or None, required)])
TABS: dict[str, tuple[str, str, str, list[tuple[str, list[str] | None, bool]]]] = {
    "activity": ("12 Activity Log", "Every action by every person and agent, same day (BRIEF §5).",
                 "Append only. Agents write here after every action.",
                 [("date_ist", None, True), ("actor", None, True), ("action", None, True), ("item", None, True),
                  ("status", None, True), ("needs_approval", YESNO, True), ("source", None, False), ("notes", None, False)]),
    "tasks": ("13 Tasks", "Open work and blockers, each with an owner.",
              "Log a blocker the moment it appears. Status: not started / in progress / blocked / done.",
              [("task", None, True), ("owner", None, True), ("priority", ["high", "medium", "low"], True),
               ("status", STATUS, True), ("due_date", None, False), ("blocker", None, False)]),
    "approvals": ("14 Approvals", "Anything that contacts a new party, quotes a price, commits volume, moves money, signs, or posts.",
                  "Flow: agent -> Atlas reviews -> Mahesh and Punam decide. Decision: pending / approved / rejected / changed.",
                  [("item", None, True), ("requested_by", None, True), ("reason", None, True), ("risk", None, True),
                   ("atlas_review", None, False), ("decision", ["pending", "approved", "rejected", "changed"], True),
                   ("decided_by", None, False), ("date", None, False)]),
    "decisions": ("15 Decisions", "Founder decisions and why.", "Decided by Mahesh and/or Punam.",
                  [("date", None, True), ("decision", None, True), ("who_decided", None, True),
                   ("reason", None, False), ("what_it_changes", None, False)]),
    "diversification": ("16 Diversification", "Vista pipeline: stability screen and Gates 0-6 (BRIEF §7).",
                        "Stage: screen / gate 0 ... gate 6 / dropped. Figures without a source cannot pass a gate.",
                        [("product", None, True), ("hs_code", None, False),
                         ("stage", ["screen", "gate 0", "gate 1", "gate 2", "gate 3", "gate 4", "gate 5", "gate 6", "dropped"], True),
                         ("screen_result", ["pass", "fail", "unclear", "pending"], True), ("owner", None, True),
                         ("next_gate_date", None, False), ("go_no_go", ["go", "wait", "drop", "pending"], False),
                         ("reason", None, False), ("sources", None, False)]),
    "compliance": ("17 Compliance", "Registrations, certifications and filing deadlines (Compass).",
                   "Status 'held' only when a person has seen the certificate or registration document.",
                   [("item", None, True), ("type", ["registration", "certification", "filing", "other"], True),
                    ("status", ["held", "applied", "not held", "unknown"], True), ("number_ref", None, False),
                    ("expiry", None, False), ("evidence", None, False), ("owner", None, True), ("next_action", None, False)]),
    "marketing": ("18 Marketing KPIs", "Weekly marketing numbers.",
                  "Targets: 50,000 reach / month, 15 sample leads / month, 6 posts / week.",
                  [("week_start", None, True), ("fb_reach", None, False), ("sample_leads", None, False),
                   ("group_posts", None, False), ("linkedin_connections", None, False), ("linkedin_posts", None, False),
                   ("source", None, False), ("notes", None, False)]),
}


def die(msg: str, code: int = 1) -> None:
    print(f"tracker: {msg}", file=sys.stderr)
    sys.exit(code)


def tracker_path() -> Path:
    p = Path(os.environ.get("TRACKER_PATH", DEFAULT_PATH)).expanduser()
    if not p.exists():
        die(f"workbook not found: {p}")
    return p


def assert_not_open(p: Path) -> None:
    """Refuse to write if a spreadsheet app has the file open."""
    try:
        out = subprocess.run(["lsof", "-t", str(p)], capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        out = ""
    if out:
        die(f"workbook is open in another program (pid {out.split()[0]}). Close it and retry.", 3)
    now = time.time()
    for lock in (p.parent / f".~lock.{p.name}#", p.parent / f"~${p.name}"):
        if lock.exists() and now - lock.stat().st_mtime < FRESH_LOCK_HOURS * 3600:
            die(f"recent lock file {lock.name} suggests the workbook is open. Close it and retry.", 3)


def backup(p: Path) -> Path:
    d = p.parent / "backups"
    d.mkdir(exist_ok=True)
    dst = d / f"{p.stem}.{datetime.now(IST):%Y%m%d-%H%M%S-%f}{p.suffix}"
    shutil.copy2(p, dst)
    olds = sorted(d.glob(f"{p.stem}.*{p.suffix}"))
    for old in olds[:-KEEP_BACKUPS]:
        old.unlink()
    return dst


def save(wb, p: Path) -> None:
    fd, tmp = tempfile.mkstemp(suffix=p.suffix, dir=p.parent)
    os.close(fd)
    try:
        wb.save(tmp)
        os.replace(tmp, p)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def resolve(wb, name: str):
    key = name.lower().strip()
    if key in TABS:
        title = TABS[key][0]
        if title not in wb.sheetnames:
            die(f"tab '{title}' does not exist yet. Run: tracker.py init")
        return wb[title], TABS[key][3]
    if name in wb.sheetnames:
        return wb[name], None
    die(f"unknown tab '{name}'. Short names: {', '.join(TABS)}; sheets: {', '.join(wb.sheetnames)}")


def header(ws) -> list[str]:
    return [str(c.value).strip() if c.value is not None else "" for c in ws[HEADER_ROW]]


def last_row(ws) -> int:
    """Last row (>= HEADER_ROW) with any value. Formula-only template rows count as empty."""
    last = HEADER_ROW
    for r in range(FIRST_DATA_ROW, ws.max_row + 1):
        vals = [c.value for c in ws[r]]
        if any(v not in (None, "") and not (isinstance(v, str) and v.startswith("=")) for v in vals):
            last = r
    return last


def cmd_init() -> None:
    p = tracker_path()
    wb = load_workbook(p)
    missing = [k for k, t in TABS.items() if t[0] not in wb.sheetnames]
    if not missing:
        print("all tracker tabs already exist")
        return
    assert_not_open(p)
    b = backup(p)
    for key in missing:
        title, sub, note, cols = TABS[key]
        ws = wb.create_sheet(title)
        width = max(len(cols), 6)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=width)
        ws.cell(1, 1, title[3:]).font = Font(name="Arial", size=18, bold=True, color="FFFFFFFF")
        ws.cell(1, 1).fill = PatternFill("solid", fgColor=TEAL)
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=width)
        ws.cell(2, 1, sub).font = Font(name="Arial", size=10, color=INK)
        ws.cell(2, 1).fill = PatternFill("solid", fgColor=CREAM)
        ws.cell(4, 1, note).font = Font(name="Arial", size=9, color=GREY)
        for i, (col, allowed, required) in enumerate(cols, start=1):
            c = ws.cell(HEADER_ROW, i, col)
            c.font = Font(name="Arial", size=11, bold=True, color="FFFFFFFF")
            c.fill = PatternFill("solid", fgColor=TEAL)
            c.alignment = Alignment(vertical="center", wrap_text=True)
            ws.column_dimensions[c.column_letter].width = 40 if col in ("notes", "reason", "item", "task", "decision", "atlas_review", "sources", "evidence", "action") else 18
        ws.freeze_panes = ws.cell(FIRST_DATA_ROW, 1)
    save(wb, p)
    print(json.dumps({"added": [TABS[k][0] for k in missing], "backup": str(b)}))


def cmd_tabs() -> None:
    wb = load_workbook(tracker_path(), read_only=True, data_only=True)
    short = {v[0]: k for k, v in TABS.items()}
    for ws in wb.worksheets:
        print(f"{ws.title}\t{short.get(ws.title, '')}")


def cmd_columns(name: str) -> None:
    key = name.lower().strip()
    if key not in TABS:
        die("columns is only defined for tracker tabs: " + ", ".join(TABS))
    for col, allowed, req in TABS[key][3]:
        need = "auto (filled if omitted)" if (key, col) == ("activity", "date_ist") else ("required" if req else "optional")
        print(f"{col}\t{need}\t{'|'.join(allowed) if allowed else ''}")


def cmd_read(name: str, last: int | None) -> None:
    wb = load_workbook(tracker_path(), data_only=True)
    ws, _ = resolve(wb, name)
    hdr = header(ws)
    rows = []
    for r in range(FIRST_DATA_ROW, last_row(ws) + 1):
        vals = [c.value for c in ws[r]]
        if not any(v not in (None, "") for v in vals):
            continue
        rows.append({(hdr[i] or f"col{i+1}"): (v.isoformat() if hasattr(v, "isoformat") else v)
                     for i, v in enumerate(vals) if i < len(hdr) and v not in (None, "")})
    if last:
        rows = rows[-last:]
    print(json.dumps(rows, ensure_ascii=False, indent=1, default=str))


def cmd_read_source(alias: str, sheet: str | None, last: int | None) -> None:
    if alias not in SOURCES:
        die(f"unknown workbook '{alias}'. Choose: {', '.join(SOURCES)}")
    path = Path(SOURCES[alias])
    if not path.exists():
        die(f"workbook not found: {path}")
    wb = load_workbook(path, read_only=True, data_only=True)
    if not sheet:
        for ws in wb.worksheets:
            print(ws.title)
        return
    if sheet not in wb.sheetnames:
        die(f"no sheet '{sheet}' in {alias}. Sheets: {', '.join(wb.sheetnames)}")
    rows = [list(r) for r in wb[sheet].iter_rows(values_only=True)]
    # header = first row with at least 4 text cells (these files put headers in rows 2-6)
    h = next((i for i, r in enumerate(rows) if sum(isinstance(v, str) and v.strip() != "" for v in r) >= 4), None)
    if h is None:
        die(f"could not find a header row in '{sheet}'")
    hdr = [str(v).strip() if v is not None else f"col{i+1}" for i, v in enumerate(rows[h])]
    out = []
    for r in rows[h + 1:]:
        if not any(v not in (None, "") for v in r):
            continue
        out.append({hdr[i]: (v.isoformat() if hasattr(v, "isoformat") else v)
                    for i, v in enumerate(r) if i < len(hdr) and v not in (None, "")})
    if last:
        out = out[-last:]
    print(json.dumps({"workbook": alias, "sheet": sheet, "header_row": h + 1,
                      "note": "Source file claims (e.g. 'verified', certifications) are UNVERIFIED until checked.",
                      "rows": out}, ensure_ascii=False, indent=1, default=str))


def validate(row: dict, cols) -> dict:
    names = [c[0] for c in cols]
    unknown = set(row) - set(names)
    if unknown:
        die(f"unknown column(s) {sorted(unknown)}. Expected: {names}")
    for col, allowed, required in cols:
        v = row.get(col)
        if required and (v is None or str(v).strip() == ""):
            die(f"missing required column '{col}'")
        if allowed and v not in (None, "") and str(v).lower().strip() not in allowed:
            die(f"'{col}' must be one of {allowed}, got {v!r}")
    return row


def cmd_append(name: str, payload: str) -> None:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as e:
        die(f"payload is not valid JSON: {e}")
    rows = data if isinstance(data, list) else [data]
    if not rows or not all(isinstance(r, dict) for r in rows):
        die("payload must be a JSON object or an array of objects")
    p = tracker_path()
    wb = load_workbook(p)
    ws, cols = resolve(wb, name)
    hdr = header(ws)
    if cols:
        if name.lower().strip() == "activity":
            for r in rows:
                r.setdefault("date_ist", datetime.now(IST).strftime("%Y-%m-%d %H:%M"))
        rows = [validate(r, cols) for r in rows]
    else:
        # existing toolkit sheet: keys must match its header text exactly
        bad = [k for r in rows for k in r if k not in hdr]
        if bad:
            die(f"unknown column(s) {sorted(set(bad))} for '{ws.title}'. Header: {[h for h in hdr if h]}")
    assert_not_open(p)
    b = backup(p)
    start = last_row(ws) + 1
    for i, r in enumerate(rows):
        for key, val in r.items():
            ws.cell(start + i, hdr.index(key) + 1, val)
    save(wb, p)
    print(json.dumps({"tab": ws.title, "rows_added": len(rows), "first_row": start, "backup": str(b)}))


def main(argv: list[str]) -> None:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, rest = argv[0], argv[1:]
    if cmd == "init":
        cmd_init()
    elif cmd == "tabs":
        cmd_tabs()
    elif cmd == "columns" and len(rest) == 1:
        cmd_columns(rest[0])
    elif cmd == "read" and rest:
        last = int(rest[rest.index("--last") + 1]) if "--last" in rest else None
        if "--workbook" in rest:
            alias = rest[rest.index("--workbook") + 1]
            pos = [a for i, a in enumerate(rest) if not a.startswith("--") and (i == 0 or rest[i - 1] not in ("--last", "--workbook"))]
            cmd_read_source(alias, pos[0] if pos else None, last)
        else:
            cmd_read(rest[0], last)
    elif cmd == "append" and len(rest) == 2:
        cmd_append(rest[0], rest[1])
    else:
        die("bad usage. Run tracker.py --help", 2)


if __name__ == "__main__":
    main(sys.argv[1:])
