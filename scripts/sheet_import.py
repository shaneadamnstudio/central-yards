#!/usr/bin/env python3
"""
Google Sheet -> Supabase importer for the Central Yards workspace.

Reads the AS x CY tracker and writes projects, activations, social ideas and
project links. Dry run by default; --commit writes.

The Sheet is a status log, not a task table: rows repeat a project by leaving
column A blank, and each row is a dated update rather than a to-do. So:

  [WIP] 2027 SOW          -> projects with next_action + activations
  ONGOING TASKS/PROJECTS  -> projects with links, latest update as next_action
  COMPLETED ...           -> skipped (it is history, not live work)
  SOCIAL MEDIA            -> social_ideas

Two tables are stacked inside [WIP] 2027 SOW and ONGOING, each with its own
header row. Header rows are detected by content, not by fixed index, so a
shifted sheet does not become a task called "PROJECTS & TASKS".

Targets are fuzzy ("Q1 2027", "Jun-Aug 2027", "TBC"). A calendar needs a date,
so a target is resolved to a representative date and marked provisional rather
than being invented as fact.

Usage
  python3 sheet_import.py                 # dry run, all tabs
  python3 sheet_import.py --commit
  python3 sheet_import.py --only sow      # one tab
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SHEET_ID = "1Sc8M3duaRU8POZ3izTYnD5J-0WveJb3PXoQa-FAPrjI"
TABS = {
    "sow": "[WIP] 2027 SOW",
    "ongoing": "ONGOING TASKS / PROJECTS",
    "completed": "COMPLETED PROJECT & DELIVERABLES SUMMARY",
    "social": "SOCIAL MEDIA",
}

MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# ------------------------------------------------------------------ google
def access_token():
    t = json.load(open("/root/.hermes/google_token.json"))
    data = urllib.parse.urlencode({
        "client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def read_tab(token, title, rng="A1:J60"):
    rng_q = urllib.parse.quote(f"{title}!{rng}", safe="")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{rng_q}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("values", [])


# ------------------------------------------------------------------ helpers
def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return s[:60] or "item"


def is_header(row):
    """A header row names its columns; a data row contains a date or a status."""
    joined = " ".join(str(c).lower() for c in row)
    return ("status" in joined and ("target" in joined or "date" in joined or "post" in joined)) \
        or joined.strip().startswith("projects & tasks")


def parse_date(s):
    """'Oct 26, 2026' / 'November 11, 2026' / '17 November 2026' -> ISO."""
    if not s:
        return None
    s = str(s).strip()
    m = re.match(r"([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})", s)
    if m:
        mon = MONTHS.get(m.group(1)[:3].lower())
        if mon:
            return f"{m.group(3)}-{mon:02d}-{int(m.group(2)):02d}"
    m = re.match(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", s)
    if m:
        mon = MONTHS.get(m.group(2)[:3].lower())
        if mon:
            return f"{m.group(3)}-{mon:02d}-{int(m.group(1)):02d}"
    return None


def resolve_target(s, default_year=2027):
    """
    Turn a fuzzy target into (start_date, end_date, provisional).

    'Q1 2027'      -> quarter start and end
    'Jun-Aug 2027' -> span
    'Feb 2027'     -> whole month
    'Nov 2026'     -> whole month, that year
    'TBC' / '-'    -> None
    """
    if not s:
        return None, None, False
    t = str(s).strip().lower()
    if t in ("tbc", "-", "", "n/a"):
        return None, None, False

    year_m = re.search(r"(20\d{2})", t)
    year = int(year_m.group(1)) if year_m else default_year

    q = re.search(r"q([1-4])", t)
    if q:
        n = int(q.group(1))
        start_m = (n - 1) * 3 + 1
        end_m = start_m + 2
        last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][end_m - 1]
        return f"{year}-{start_m:02d}-01", f"{year}-{end_m:02d}-{last:02d}", True

    span = re.match(r"([a-z]{3,9})\s*[-–]\s*([a-z]{3,9})", t)
    if span:
        a = MONTHS.get(span.group(1)[:3])
        b = MONTHS.get(span.group(2)[:3])
        if a and b:
            last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b - 1]
            return f"{year}-{a:02d}-01", f"{year}-{b:02d}-{last:02d}", True

    single = re.match(r"([a-z]{3,9})", t)
    if single:
        m = MONTHS.get(single.group(1)[:3])
        if m:
            last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
            return f"{year}-{m:02d}-01", f"{year}-{m:02d}-{last:02d}", True

    return None, None, False


def side_from_status(status):
    s = (status or "").upper()
    if "CY" in s:
        return "central_yards"
    if "AS" in s or "ADAM" in s:
        return "adam"
    return "adam"


def status_to_app(status):
    s = (status or "").upper()
    if "COMPLETE" in s or "DONE" in s:
        return "done"
    if "BLOCK" in s or "HOLD" in s:
        return "blocked"
    if "PROGRESS" in s or "REVIEW" in s:
        return "doing"
    return "open"


# ------------------------------------------------------------------ parsers
def parse_sow(rows):
    """Projects and activations from the 2027 SOW tab."""
    projects, activations = [], []
    for row in rows:
        if not row or is_header(row):
            continue
        name = str(row[0]).strip()
        if not name or name.isupper() and len(row) < 3:
            continue
        if len(row) < 4:
            continue

        target = row[1] if len(row) > 1 else ""
        updated = row[2] if len(row) > 2 else ""
        next_step = row[3] if len(row) > 3 else ""
        status = row[4] if len(row) > 4 else ""

        pid = "sheet-" + slug(name)
        start, end, provisional = resolve_target(target)

        projects.append({
            "id": pid,
            "name": name.title() if name.isupper() else name,
            "summary": (next_step or "")[:400],
            "status": "active",
            "lane": "special",
            "tier": None,
            "owner_name": "",
            "owner_side": side_from_status(status),
            "key_dates": [],
            "next_action": (next_step or "")[:200],
            "next_action_due": None,
            "visibility": "shared",
            "source": "sheet",
            "source_id": f"sow:{slug(name)}",
            "position": 0,
        })

        if start:
            activations.append({
                "id": "act-" + slug(name),
                "title": name.title() if name.isupper() else name,
                "detail": (next_step or "")[:500],
                "start_date": start,
                "end_date": end,
                "audience": "joint",
                "series_id": None,
                "pitch_room": True,
                "pitch_note": f"Target {target}. Provisional date from the 2027 SOW; confirm the exact day."
                              if provisional else "",
                "colour": "",
                "visibility": "shared",
                "source": "sheet",
            })
    return projects, activations


def parse_ongoing(rows):
    """Projects with links. Blank column A means the row belongs to the one above."""
    projects, links = [], []
    current = None
    for row in rows:
        if not row or is_header(row) or str(row[0]).upper().startswith("LAST UPDATED"):
            continue
        name = str(row[0]).strip()
        # a title row ("ADAM X CENTRAL YARDS | ONGOING...") is not a project
        if name and ("ADAM X CENTRAL" in name.upper() or name.upper().startswith("PROJECTS &")):
            continue
        if name:
            lines = [l.strip() for l in name.split("\n") if l.strip()]
            # "PRODUCTION ITEM:\nCOMPLIMENT CARDS" -> COMPLIMENT CARDS
            if lines and lines[0].rstrip(":").upper().startswith("PRODUCTION ITEM"):
                current = lines[1] if len(lines) > 1 else lines[0]
            else:
                current = lines[0] if lines else name
            pid = "sheet-" + slug(current)
            projects.append({
                "id": pid,
                "name": current.title() if current.isupper() else current,
                "summary": str(row[2])[:400] if len(row) > 2 else "",
                "status": "active",
                "lane": "general",
                "tier": None,
                "owner_name": "",
                "owner_side": "adam",
                "key_dates": [],
                "next_action": str(row[2])[:200] if len(row) > 2 else "",
                "next_action_due": parse_date(row[1]) if len(row) > 1 else None,
                "visibility": "shared",
                "source": "sheet",
                "source_id": f"ongoing:{slug(current)}",
                "position": 0,
            })
        if not current:
            continue
        url = str(row[5]).strip() if len(row) > 5 else ""
        if url.startswith("http"):
            kind = "folder" if "dropbox" in url else ("deck" if "figma" in url else "doc")
            links.append({
                "id": "lnk-" + slug(current) + "-" + slug(url[-24:]),
                "project_id": "sheet-" + slug(current),
                "kind": kind,
                "label": f"{current.title() if current.isupper() else current} · {parse_date(row[1]) or 'update'}",
                "url": url,
                "visibility": "shared",
                "added_by": "sheet import",
                "position": 0,
            })
    return projects, links


def parse_social(rows):
    out = []
    current_post = None
    for row in rows:
        if not row or is_header(row) or str(row[0]).upper().startswith("LAST UPDATED"):
            continue
        post = str(row[1]).strip() if len(row) > 1 else ""
        if post:
            current_post = post
            out.append({
                "id": "soc-" + slug(post),
                "title": post,
                "body": (str(row[3])[:600] if len(row) > 3 else ""),
                "theme": str(row[0]).strip().title(),
                "channel": "Instagram",
                "status": "developing",
                "link_project": None,
                "visibility": "internal",
                "position": 0,
                "source": "sheet",
            })
        elif current_post and len(row) > 3 and str(row[3]).strip():
            # a continuation line adds detail to the post above
            for item in out:
                if item["title"] == current_post:
                    item["body"] = (item["body"] + "\n" + str(row[3]).strip())[:1200]
    return out


# ------------------------------------------------------------------ write
def post(url, key, table, rows, on_conflict="id"):
    body = json.dumps(rows).encode()
    req = urllib.request.Request(f"{url}/rest/v1/{table}?on_conflict={on_conflict}",
                                data=body, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates,return=representation")
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            got = json.loads(r.read().decode() or "[]")
        if not got:
            die(f"{table}: write returned no rows (grant missing?)")
        return len(got)
    except urllib.error.HTTPError as e:
        die(f"{table}: {e.code} {e.read().decode()[:300]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--only", choices=list(TABS), help="one tab only")
    args = ap.parse_args()

    token = access_token()
    which = [args.only] if args.only else ["sow", "ongoing", "social"]

    projects, activations, links, social = [], [], [], []

    for key in which:
        rows = read_tab(token, TABS[key])
        print(f"{TABS[key]}: {len(rows)} rows")
        if key == "sow":
            p, a = parse_sow(rows)
            projects += p
            activations += a
            print(f"  -> {len(p)} projects, {len(a)} activations")
        elif key == "ongoing":
            p, l = parse_ongoing(rows)
            projects += p
            links += l
            print(f"  -> {len(p)} projects, {len(l)} links")
        elif key == "social":
            s = parse_social(rows)
            social += s
            print(f"  -> {len(s)} social ideas")

    # de-dupe projects across tabs: SOW wins over ongoing for the same name
    seen = {}
    for p in projects:
        seen.setdefault(p["id"], p)
    projects = list(seen.values())

    # Postgres will not upsert the same id twice in one statement, and the same
    # URL can legitimately appear under two rows. Keep the first of each id.
    def dedupe(rows):
        seen, out = set(), []
        for r in rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            out.append(r)
        return out

    projects, activations, links, social = (
        dedupe(projects), dedupe(activations), dedupe(links), dedupe(social))

    print(f"\nTOTAL: {len(projects)} projects, {len(activations)} activations, "
          f"{len(links)} links, {len(social)} social ideas")

    print("\nActivations to be created:")
    for a in activations:
        print(f"  {a['start_date']} .. {a['end_date']}  {a['title'][:56]}")

    if not args.commit:
        print("\nDRY RUN. nothing written. re-run with --commit.")
        return

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        die("--commit needs SUPABASE_URL and SUPABASE_KEY")

    # order matters: projects first (links and tasks reference them)
    n = post(url, key, "projects", projects); print(f"projects written: {n}")
    if activations:
        n = post(url, key, "activations", activations); print(f"activations written: {n}")
    if links:
        n = post(url, key, "project_links", links); print(f"links written: {n}")
    if social:
        n = post(url, key, "social_ideas", social); print(f"social written: {n}")

    # read back
    def count(table):
        req = urllib.request.Request(f"{url}/rest/v1/{table}?select=id&source=eq.sheet", method="GET")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        with urllib.request.urlopen(req, timeout=30) as r:
            return len(json.loads(r.read().decode() or "[]"))

    print("\nread back:")
    for t in ("projects", "activations", "project_links"):
        try:
            print(f"  {t}: {count(t)}")
        except urllib.error.HTTPError:
            print(f"  {t}: (no source column)")
    print("done.")


if __name__ == "__main__":
    main()
