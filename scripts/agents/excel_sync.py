#!/usr/bin/env python3
"""Bridge between the Supabase agent tracker and the founders' Excel files (run on the Mac).

  excel_sync.py import-tracker            one-time: copy rows from toolkit tabs 12-18 into Supabase
                                          (refuses if the Supabase tables already have rows)
  excel_sync.py import-sources [name...]  copy the research workbooks into agent_sources (read-only
                                          copies for agents). Re-importing a workbook replaces its rows.
                                          Names: master, contacts, marketing, trademap, actionpack
  excel_sync.py export                    write the Supabase tracker into toolkit tabs 12-20 so it can
                                          be opened in Excel (replaces those tabs' data rows; backup first)

Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (main checkout).
The key is never printed.
"""
from __future__ import annotations

import json
import os
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

TOOLKIT = Path(os.environ.get("TRACKER_PATH", "/Users/mahesh/Documents/Claude/Projects/Brindari.com/03_Brindari_Operations_Toolkit.xlsx"))
SOURCES = {
    "master":     "/Users/mahesh/Downloads/Brindari_Master_v5.xlsx",
    "contacts":   "/Users/mahesh/Desktop/Brindari Global Research/2. Brindari_Buyer_Supplier_Contacts.xlsx",
    "marketing":  "/Users/mahesh/Downloads/Brindari_Marketing_Research_v3.xlsx",
    "trademap":   "/Users/mahesh/Desktop/Brindari Global Research/5. Brindari_TradeMap_Analysis.xlsx",
    "actionpack": "/Users/mahesh/Desktop/Brindari Global Research/4. Brindari_ActionPack.xlsx",
}
IST = timezone(timedelta(hours=5, minutes=30))
try:  # python.org builds on macOS ship without CA certificates; use certifi's bundle when present
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
HEADER_ROW, FIRST = 6, 7
TEAL, CREAM = "FF0F6E56", "FFFAEEDA"

# Excel tab -> (Supabase table, columns exported in order)
EXPORT = [
    ("12 Activity Log",   "agent_activity",        ["created_at", "actor", "action", "item", "status", "needs_approval", "source", "notes"]),
    ("13 Tasks",          "agent_tasks",           ["created_at", "task", "owner", "priority", "status", "due_date", "blocker"]),
    ("14 Approvals",      "agent_approvals",       ["created_at", "item", "requested_by", "reason", "risk", "atlas_review", "decision", "decided_by", "decided_at", "decision_note"]),
    ("15 Decisions",      "agent_decisions",       ["decided_on", "decision", "who_decided", "reason", "what_it_changes"]),
    ("16 Diversification","agent_diversification", ["created_at", "product", "hs_code", "stage", "screen_result", "owner", "next_gate_date", "go_no_go", "reason", "sources"]),
    ("17 Compliance",     "agent_compliance",      ["created_at", "item", "type", "status", "number_ref", "expiry", "evidence", "owner", "next_action"]),
    ("18 Marketing KPIs", "agent_marketing_kpis",  ["week_start", "fb_reach", "sample_leads", "group_posts", "linkedin_connections", "linkedin_posts", "source", "notes"]),
    ("19 Prospects",      "agent_prospects",       ["created_at", "company", "country", "contact", "verification", "evidence", "source_list", "notes"]),
    ("20 Supplier Reviews","agent_supplier_reviews",["created_at", "supplier_name", "location", "source", "quality", "price", "lead_time", "trust", "communication", "certifications_claimed", "certificates_seen", "recommendation", "evidence", "notes"]),
]


def die(msg: str, code: int = 1):
    print(f"excel_sync: {msg}", file=sys.stderr)
    sys.exit(code)


def env() -> tuple[str, str]:
    vals = {}
    try:
        common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                                capture_output=True, text=True, check=True).stdout.strip()
        candidates = [Path(".env.local"), Path(common).parent / ".env.local"]
    except Exception:
        candidates = [Path(".env.local")]
    for f in candidates:
        if f.exists():
            for line in f.read_text().splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1)
                    vals.setdefault(k.strip(), v.strip().strip("'\""))
            break
    url, key = vals.get("NEXT_PUBLIC_SUPABASE_URL"), vals.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        die("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local")
    return url.rstrip("/") + "/rest/v1/", key


def api(method: str, path: str, body=None, params: dict | None = None):
    base, key = env()
    url = base + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json",
        "Content-Type": "application/json", "Prefer": "return=representation"})
    if body is not None:
        req.data = json.dumps(body, default=str).encode()
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
            text = r.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        die(f"{method} {path} failed: HTTP {e.code} {e.read().decode()[:300]}")


def header_and_rows(ws, header_row=None):
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    if header_row is None:
        header_row = next((i for i, r in enumerate(rows) if sum(bool(isinstance(v, str) and v.strip()) for v in r) >= 4), None)
        if header_row is None:
            return [], []
    else:
        header_row -= 1
    hdr = [str(v).strip() if v is not None else f"col{i+1}" for i, v in enumerate(rows[header_row])]
    out = []
    for n, r in enumerate(rows[header_row + 1:], start=header_row + 2):
        if any(v not in (None, "") for v in r):
            out.append((n, {hdr[i]: (v.isoformat() if hasattr(v, "isoformat") else v)
                            for i, v in enumerate(r) if i < len(hdr) and v not in (None, "")}))
    return hdr, out


def cmd_import_sources(names):
    names = names or list(SOURCES)
    for name in names:
        if name not in SOURCES:
            die(f"unknown workbook {name}")
        path = Path(SOURCES[name])
        if not path.exists():
            print(f"skip {name}: not found at {path}")
            continue
        wb = load_workbook(path, read_only=True, data_only=True)
        api("DELETE", "agent_sources", params={"workbook": f"eq.{name}"})
        total = 0
        for ws in wb.worksheets:
            _, rows = header_and_rows(ws)
            batch = [{"workbook": name, "sheet": ws.title, "row_num": n, "data": d} for n, d in rows]
            for i in range(0, len(batch), 200):
                api("POST", "agent_sources", batch[i:i + 200])
            total += len(batch)
        print(f"{name}: {total} rows imported")


def ist_iso(s: str) -> str:
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=IST).isoformat()
    except Exception:
        return datetime.now(IST).isoformat()


def cmd_import_tracker():
    for table in ("agent_activity", "agent_tasks", "agent_decisions"):
        if api("GET", table, params={"select": "id", "limit": "1"}):
            die(f"{table} already has rows; import-tracker is one-time only")
    wb = load_workbook(TOOLKIT, read_only=True, data_only=True)
    def rows(title):
        if title not in wb.sheetnames:
            return []
        return [d for _, d in header_and_rows(wb[title], HEADER_ROW)[1]]
    act = [{"created_at": ist_iso(r.get("date_ist", "")), "actor": r["actor"], "action": r["action"], "item": r["item"],
            "status": r["status"], "needs_approval": r.get("needs_approval") == "yes",
            "source": r.get("source"), "notes": r.get("notes")} for r in rows("12 Activity Log")]
    tasks = [{k: r.get(k) for k in ("task", "owner", "priority", "status", "due_date", "blocker")} for r in rows("13 Tasks")]
    # the earlier append-only tracker logged status changes as extra "Mark done:" rows; fold them in
    done = [t for t in tasks if str(t["task"]).startswith("Mark done:")]
    tasks = [t for t in tasks if not str(t["task"]).startswith("Mark done:")]
    for d in done:
        for t in tasks:
            if t["task"].startswith("Create or approve scheduled Atlas") or t["task"].startswith("Approve creating scheduled"):
                t["status"] = "done"
    appr = [{"item": r["item"], "requested_by": r["requested_by"], "reason": r["reason"], "risk": r["risk"],
             "atlas_review": r.get("atlas_review"), "decision": r.get("decision", "pending")} for r in rows("14 Approvals")]
    dec = [{"decided_on": str(r.get("date", ""))[:10] or None, "decision": r["decision"], "who_decided": r["who_decided"],
            "reason": r.get("reason"), "what_it_changes": r.get("what_it_changes")} for r in rows("15 Decisions")]
    for table, data in (("agent_activity", act), ("agent_tasks", tasks), ("agent_approvals", appr), ("agent_decisions", dec)):
        if data:
            api("POST", table, data)
        print(f"{table}: {len(data)} rows imported")


def assert_closed(p: Path):
    out = subprocess.run(["lsof", "-t", str(p)], capture_output=True, text=True).stdout.strip()
    lock = p.parent / f".~lock.{p.name}#"
    if out or (lock.exists() and time.time() - lock.stat().st_mtime < 12 * 3600):
        die("the toolkit workbook is open; close it and retry", 3)


def cmd_export():
    assert_closed(TOOLKIT)
    bdir = TOOLKIT.parent / "backups"
    bdir.mkdir(exist_ok=True)
    shutil.copy2(TOOLKIT, bdir / f"{TOOLKIT.stem}.{datetime.now(IST):%Y%m%d-%H%M%S-%f}{TOOLKIT.suffix}")
    wb = load_workbook(TOOLKIT)
    for title, table, cols in EXPORT:
        data = api("GET", table, params={"select": ",".join(cols), "order": "created_at.asc", "limit": "10000"})
        if title not in wb.sheetnames:
            ws = wb.create_sheet(title)
            ws.cell(1, 1, title[3:]).font = Font(name="Arial", size=18, bold=True, color="FFFFFFFF")
            ws.cell(1, 1).fill = PatternFill("solid", fgColor=TEAL)
            ws.cell(2, 1, "Exported from Supabase (source of truth). Edit in the dashboard, not here.").fill = PatternFill("solid", fgColor=CREAM)
        ws = wb[title]
        ws.cell(4, 1, f"Exported from Supabase {datetime.now(IST):%Y-%m-%d %H:%M} IST. Supabase is the source of truth; edits here are not synced back.")
        for i, c in enumerate(cols, start=1):
            cell = ws.cell(HEADER_ROW, i, c)
            cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFFFF")
            cell.fill = PatternFill("solid", fgColor=TEAL)
            cell.alignment = Alignment(wrap_text=True)
        if ws.max_row >= FIRST:
            ws.delete_rows(FIRST, ws.max_row - FIRST + 1)
        for r, row in enumerate(data, start=FIRST):
            for i, c in enumerate(cols, start=1):
                v = row.get(c)
                ws.cell(r, i, ("yes" if v else "no") if isinstance(v, bool) else v)
        ws.freeze_panes = ws.cell(FIRST, 1)
        print(f"{title}: {len(data)} rows")
    fd, tmp = tempfile.mkstemp(suffix=".xlsx", dir=TOOLKIT.parent)
    os.close(fd)
    wb.save(tmp)
    os.replace(tmp, TOOLKIT)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
    elif a[0] == "import-tracker":
        cmd_import_tracker()
    elif a[0] == "import-sources":
        cmd_import_sources(a[1:])
    elif a[0] == "export":
        cmd_export()
    else:
        die("unknown command; see --help", 2)
