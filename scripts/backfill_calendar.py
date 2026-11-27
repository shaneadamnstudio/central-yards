#!/usr/bin/env python3
"""
Backfill the calendar with historical and planned work, 2025 through 2028.

The app's calendar only renders activations. Completed and ongoing projects sat
in the projects table and never reached the calendar, which is why the past
looked empty. This creates an activation for every project that has a usable
date, so the calendar shows the whole record: delivered work behind, planned
work ahead.

Only readable dates become events. A project with no date stays off the
calendar rather than being given a fabricated one.

Usage
  python3 backfill_calendar.py            # dry run
  python3 backfill_calendar.py --commit
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://khwbtduvdfrlozsupvls.supabase.co")
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def die(m):
    print(f"ERROR: {m}", file=sys.stderr)
    sys.exit(1)


def key():
    k = os.environ.get("SUPABASE_KEY")
    if k:
        return k
    try:
        return open("/root/central-yards/.supabase_service_key").read().strip()
    except OSError:
        die("no SUPABASE_KEY")


def rest(path, method="GET", body=None, k=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", k)
    req.add_header("Authorization", f"Bearer {k}")
    if data:
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=representation")
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        die(f"{method} {path}: {e.code} {e.read().decode()[:250]}")


# ---------------------------------------------------------------- date logic
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:60] or "item"


def parse_span(text, default_year=2026):
    """
    Turn a title tail into (start, end).

    'June – October 2026'    -> 2026-06-01 .. 2026-10-31
    'May 2026'               -> 2026-05-01 .. 2026-05-31
    'Nov 2026'               -> 2026-11-01 .. 2026-11-30
    'Sep 29, 2026'           -> 2026-09-29 .. 2026-09-29 (a single day)
    """
    if not text:
        return None, None
    t = str(text).lower().strip()

    year_m = re.search(r"(20\d{2})", t)
    year = int(year_m.group(1)) if year_m else default_year

    # a single explicit day
    d = re.search(r"([a-z]{3,9})\s+(\d{1,2}),?\s*(20\d{2})?", t)
    if d and MONTHS.get(d.group(1)[:3]) and re.search(r"[a-z]{3,9}\s+\d{1,2}", t):
        m = MONTHS[d.group(1)[:3]]
        day = int(d.group(2))
        iso = f"{year}-{m:02d}-{day:02d}"
        return iso, iso

    span = re.search(r"([a-z]{3,9})\s*(?:-|–|—|to)\s*([a-z]{3,9})", t)
    if span:
        a, b = MONTHS.get(span.group(1)[:3]), MONTHS.get(span.group(2)[:3])
        if a and b:
            return f"{year}-{a:02d}-01", f"{year}-{b:02d}-{LAST_DAY[b-1]:02d}"

    single = re.search(r"([a-z]{3,9})", t)
    if single and MONTHS.get(single.group(1)[:3]):
        m = MONTHS[single.group(1)[:3]]
        return f"{year}-{m:02d}-01", f"{year}-{m:02d}-{LAST_DAY[m-1]:02d}"

    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()
    k = key()

    projects = rest("projects?select=id,name,status,summary,source_id,next_action_due", k=k)
    existing = rest("activations?select=id,title,start_date", k=k)
    have = {a["id"] for a in existing}

    print(f"projects: {len(projects)}   existing activations: {len(existing)}\n")

    rows, skipped = [], []
    for p in projects:
        # already on the calendar? do not duplicate what the SOW import made
        if "act-" + slug(p["name"]) in have:
            continue
        if "act-" + slug(p["name"]).replace("sheet-", "") in have:
            continue

        start, end = None, None
        done = p.get("status") == "complete"

        # A title span ('June - October 2026') is the best evidence of when a
        # project ran. Try that first.
        start, end = parse_span(p.get("summary") or "", default_year=2026)
        if not start:
            start, end = parse_span(p.get("name") or "", default_year=2026)

        # Only if there is no span: use the latest update date. For completed
        # work that is the delivery marker; for active work it is the last
        # touch, so label it as such rather than implying a scheduled day.
        fell_back = False
        if not start and p.get("next_action_due"):
            start = end = p["next_action_due"]
            fell_back = True

        if not start:
            skipped.append(p["name"])
            continue

        year = int(start[:4])
        if year < 2025 or year > 2028:
            skipped.append(f"{p['name']} ({year} outside range)")
            continue

        rows.append({
            "id": "act-" + slug(p["name"]),
            "title": p["name"],
            "detail": (p.get("summary") or "")[:400],
            "start_date": start,
            "end_date": end or start,
            "audience": "joint",
            "series_id": None,
            "pitch_room": False,
            "pitch_note": ("Delivered work. Date is the last tracker update."
                           if done and fell_back else
                           "Delivered work, dated from the tracker." if done else
                           "Last tracker update, not a scheduled date."
                           if fell_back else
                           "Planned work, dated from the tracker."),
            "colour": "historic" if done else "",
            "visibility": "shared",
            "source": "backfill",
        })

    print(f"would add {len(rows)} calendar events")
    for r in sorted(rows, key=lambda x: x["start_date"]):
        mark = "done" if r["colour"] == "historic" else "plan"
        print(f"  {r['start_date']} .. {r['end_date']}  [{mark}] {r['title'][:44]}")

    if skipped:
        print(f"\nno usable date, left off the calendar ({len(skipped)}):")
        for s in skipped:
            print(f"  - {s}")

    if not args.commit:
        print("\nDRY RUN. re-run with --commit.")
        return

    if rows:
        got = rest("activations?on_conflict=id", method="POST", body=rows, k=k)
        print(f"\nwritten: {len(got)}")

    back = rest("activations?select=id,start_date&source=eq.backfill", k=k)
    print(f"read back: {len(back)} backfilled events")
    years = {}
    for b in back:
        years[b["start_date"][:4]] = years.get(b["start_date"][:4], 0) + 1
    print("by year:", dict(sorted(years.items())))


if __name__ == "__main__":
    main()
