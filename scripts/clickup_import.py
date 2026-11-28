#!/usr/bin/env python3
"""
ClickUp -> Supabase importer for the Central Yards workspace.

Reads a ClickUp list, maps it to the app's `tasks` table, and writes.

Safety: dry run by default. Nothing is written without --commit.

Usage
  # see exactly what would change, write nothing
  python3 clickup_import.py --list 1100610000001008

  # different list, or a specific status subset
  python3 clickup_import.py --list 901820362583 --commit

  # dump the mapping as JSON instead of a table
  python3 clickup_import.py --list 1100610000001008 --json

Environment
  CLICKUP_TOKEN     personal API token
  SUPABASE_URL      https://<ref>.supabase.co
  SUPABASE_KEY      service_role key (writes bypass RLS)

Rules this follows, from the Supply Co. build:
  - upsert on a stable id so a second run does not duplicate
  - read back after writing; never report success for a write that did not land
  - a failure says so and exits non-zero
  - cancelled work is excluded, not mapped to done
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CLICKUP = "https://api.clickup.com/api/v2"

# ---------------------------------------------------------------- status map
# Map on the status NAME, never on type. ClickUp types `cancelled` as `done`,
# alongside real completion, so a type filter counts abandoned work as finished.
STATUS_MAP = {
    "project artifact": "open",
    "to do": "open",
    "planning": "open",
    "in progress": "doing",
    "internal review": "doing",
    "client review": "doing",
    "revise": "doing",          # revisiting delivered work is active, not queued
    "blocked": "blocked",
    "hold": "blocked",          # parked work is not progress
    "done": "done",
    "closed": "done",
    # 'cancelled' deliberately absent: excluded from the app entirely
}
EXCLUDED = {"cancelled"}

# who counts as which side. Extend as the team grows.
ADAM_DOMAIN = "adamstudios"
CENTRAL_YARDS_HINTS = ("central yards", "cy ", "carol", "lily", "jackie")


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def api(path, token, method="GET", body=None):
    url = f"{CLICKUP}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", token)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        die(f"ClickUp {method} {path} -> {e.code}: {e.read().decode()[:200]}")
    except urllib.error.URLError as e:
        die(f"ClickUp unreachable: {e.reason}")


def fetch_tasks(token, list_id, include_closed=True, subtasks=True):
    """Page through every task in the list."""
    out, page = [], 0
    while True:
        q = urllib.parse.urlencode({
            "page": page,
            "include_closed": str(include_closed).lower(),
            "subtasks": str(subtasks).lower(),
        })
        batch = api(f"list/{list_id}/task?{q}", token).get("tasks", [])
        if not batch:
            break
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        if page > 50:
            break
    return out


def ms_to_date(ms):
    if not ms:
        return None
    return time.strftime("%Y-%m-%d", time.gmtime(int(ms) / 1000))


def field_value(task, name):
    for f in task.get("custom_fields") or []:
        if f.get("name") == name and f.get("value") not in (None, "", []):
            return f["value"]
    return None


def owner_side_for(task):
    """Prefer the owner_side field; fall back to the assignee's domain."""
    explicit = field_value(task, "owner_side")
    if explicit:
        # drop_down returns the option name, or an object on some payloads
        if isinstance(explicit, dict):
            explicit = explicit.get("name") or (explicit.get("value") or {}).get("name")
        if explicit:
            val = str(explicit).strip().lower().replace(" ", "_")
            if val in ("adam", "central_yards", "both"):
                return val
    for a in task.get("assignees") or []:
        email = (a.get("email") or "").lower()
        if ADAM_DOMAIN in email:
            return "adam"
        username = (a.get("username") or "").lower()
        if any(h in username for h in CENTRAL_YARDS_HINTS):
            return "central_yards"
    return "adam"


def link_for(task):
    """Key URL, else Staging Link, else nothing. Both are url-type fields."""
    for name in ("Key URL", "Staging Link"):
        v = field_value(task, name)
        if v:
            return str(v)
    return ""


def to_row(task, project_id=None):
    status = (task.get("status") or {}).get("status", "")
    key = status.strip().lower()

    if key in EXCLUDED:
        return None, "excluded"

    mapped = STATUS_MAP.get(key)
    if mapped is None:
        return None, f"unmapped status {status!r}"

    assignees = task.get("assignees") or []
    owner_name = ", ".join(a.get("username", "") for a in assignees if a.get("username"))

    ref = field_value(task, "project_ref")
    return {
        "id": f"cu_{task['id']}",
        "project_id": project_id or (str(ref) if ref else None),
        "title": task.get("name", "").strip(),
        "detail": "",
        "owner_name": owner_name,
        "owner_side": owner_side_for(task),
        "due_date": ms_to_date(task.get("due_date")),
        "status": mapped,
        "awaiting_from": "",
        "link_url": link_for(task),
        "visibility": field_value(task, "visibility") or "shared",
        "source": "clickup",
        "source_id": task["id"],
        "position": int(task.get("orderindex") or 0) if str(task.get("orderindex", "")).isdigit() else 0,
    }, None


def main():
    ap = argparse.ArgumentParser(description="Import a ClickUp list into the app's tasks table.")
    ap.add_argument("--list", required=True, help="ClickUp list id")
    ap.add_argument("--project", default=None, help="project_id to attach every task to")
    ap.add_argument("--commit", action="store_true", help="actually write (default is dry run)")
    ap.add_argument("--json", action="store_true", help="print rows as JSON")
    ap.add_argument("--no-subtasks", action="store_true")
    args = ap.parse_args()

    token = os.environ.get("CLICKUP_TOKEN") or _read("/root/.config/clickup/token")
    if not token:
        die("no ClickUp token (CLICKUP_TOKEN or /root/.config/clickup/token)")

    meta = api(f"list/{args.list}", token)
    if "err" in meta:
        die(f"cannot read list {args.list}: {meta['err']}")
    print(f"list: {meta['name']}  ({meta.get('task_count')} tasks)")
    print(f"folder: {(meta.get('folder') or {}).get('name')}")
    print()

    tasks = fetch_tasks(token, args.list, subtasks=not args.no_subtasks)
    print(f"fetched {len(tasks)} tasks including subtasks\n")

    rows, excluded, unmapped = [], [], {}
    for t in tasks:
        row, why = to_row(t, args.project)
        if row:
            rows.append(row)
        elif why == "excluded":
            excluded.append(t.get("name"))
        else:
            unmapped[why] = unmapped.get(why, 0) + 1

    print(f"would import : {len(rows)}")
    print(f"excluded     : {len(excluded)} (status cancelled)")
    if unmapped:
        print(f"unmapped     : {unmapped}")
    print()

    if args.json:
        print(json.dumps(rows, indent=1))
    else:
        for r in rows[:40]:
            print(f"  [{r['status']:7}] {r['title'][:56]:58} {r['owner_name'][:18]:19} {r['due_date'] or '-'}")
        if len(rows) > 40:
            print(f"  ... and {len(rows) - 40} more")

    if not args.commit:
        print("\nDRY RUN. nothing written. re-run with --commit to apply.")
        return

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        die("--commit needs SUPABASE_URL and SUPABASE_KEY")

    print("\nwriting...")
    written = 0
    for r in rows:
        req = urllib.request.Request(
            f"{url}/rest/v1/tasks?on_conflict=id",
            data=json.dumps([r]).encode(), method="POST")
        req.add_header("apikey", key)
        req.add_header("Authorization", f"Bearer {key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=representation")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                got = json.loads(resp.read().decode() or "[]")
            if not got:
                die(f"write for {r['id']} returned no row (grant missing?)")
            written += 1
        except urllib.error.HTTPError as e:
            die(f"write failed for {r['id']}: {e.code} {e.read().decode()[:200]}")

    # read back: a write is not done until the row is there
    q = ",".join(f'"{r["id"]}"' for r in rows)
    check = urllib.request.Request(
        f"{url}/rest/v1/tasks?id=in.({q})&select=id,status",
        method="GET")
    check.add_header("apikey", key)
    check.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(check, timeout=30) as resp:
        present = json.loads(resp.read().decode() or "[]")

    print(f"wrote {written}, read back {len(present)} of {len(rows)}")
    if len(present) != len(rows):
        die(f"only {len(present)} rows came back; the write did not fully land")
    print("done.")


def _read(path):
    try:
        return open(path).read().strip()
    except OSError:
        return None


if __name__ == "__main__":
    main()
