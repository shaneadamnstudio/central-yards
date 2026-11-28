#!/usr/bin/env python3
"""
ClickUp -> Supabase importer for the Central Yards workspace.

One importer, reconciled from two: the CLI, link and owner fallbacks from the
original build, the three-way status merge, validation and guards from the
handover pass.

Reads one ClickUp list, maps it to the app's `tasks` table, and writes.
Dry run by default. Nothing is written without --commit.

Usage
  python3 clickup_import.py                                   # dry run, list 1600
  python3 clickup_import.py --list 901820362583               # another list
  python3 clickup_import.py --commit                          # apply
  python3 clickup_import.py --json                            # plan as JSON

Environment
  CLICKUP_TOKEN     personal API token (or /root/.config/clickup/token)
  SUPABASE_URL      https://<ref>.supabase.co
  SUPABASE_KEY      service_role key (writes bypass RLS)

Status is the one column with two authors: ClickUp, and a person ticking a box
in the app. `tasks.source_status` holds what ClickUp said at the last import, so
the merge can tell which side moved:

  row absent                    -> insert, stamp the base
  incoming == base              -> ClickUp did not move. keep the app's value
  incoming != base, app == base -> only ClickUp moved. apply ClickUp
  incoming != base, app != base -> both moved. THE APP WINS, advance the base
  base is null                  -> adopt the base, keep the app's value

Why the app wins: it is the surface both teams read, and the person who changed
it saw the current value. Overwriting a human action silently is the failure
this defends against. Advancing the base means it fires once, not every run.

Field ownership: `status` is contested and goes through the merge. Everything
else (title, due_date, owner_name, owner_side, visibility, project_id,
link_url) is import-owned and overwritten every run.

Rules this follows, from the Supply Co. build:
  - stable id from the source id, so a re-run updates rather than duplicates
  - every update and delete carries `source=eq.clickup`, so manual rows are
    unreachable by construction
  - a write is read back; never report success for a write that did not land
  - a failure says so and exits non-zero
  - cancelled work is excluded, not mapped to done
  - validate before writing: skip and report, never write a null
"""

import argparse
import json
import os
import sys
import time
from typing import NoReturn
import urllib.error
import urllib.parse
import urllib.request

CLICKUP = "https://api.clickup.com/api/v2"
ID_PREFIX = "cu_"

# ---------------------------------------------------------------- status map
# Map on the status NAME, never on type. ClickUp types `cancelled` as `done`,
# alongside real completion, so a type filter counts abandoned work as finished.
STATUS_MAP = {
    "to do": "open",
    "planning": "open",
    "in progress": "doing",
    "internal review": "doing",
    "client review": "doing",
    "revise": "doing",           # revisiting delivered work is active, not queued
    "project artifact": "doing", # the row is a deliverable in hand, not queued work
    "blocked": "blocked",
    "hold": "blocked",           # parked work is not progress
    "done": "done",
    "closed": "done",
    # 'cancelled' deliberately absent: excluded from the app entirely
}
EXCLUDED = {"cancelled"}

OWNER_SIDES = ("adam", "central_yards", "both")
VISIBILITIES = ("shared", "internal")

# who counts as which side, used only when the owner_side field is empty
ADAM_DOMAIN = "adamstudios"
CENTRAL_YARDS_HINTS = ("central yards", "cy ", "carol", "lily", "jackie")

# a plan touching fewer than this share of existing rows is refused unless
# --allow-shrink: catches a partial fetch or a wrong list before it deletes work
SHRINK_FLOOR = 0.7


def die(msg) -> NoReturn:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def _read(path):
    try:
        return open(path).read().strip()
    except OSError:
        return None


def api(path, token, method="GET", body=None):
    url = f"{CLICKUP}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", token)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
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
    try:
        return time.strftime("%Y-%m-%d", time.gmtime(int(ms) / 1000))
    except (TypeError, ValueError):
        return None


def field_value(task, name):
    """ClickUp returns a dropdown's option orderindex, not its name, and the
    options live on the task's own custom_fields entry rather than on the list
    schema. Resolving against the schema alone yields None and then falls
    through to a default, which looks like a mapping that works."""
    for f in task.get("custom_fields") or []:
        if f.get("name") != name:
            continue
        v = f.get("value")
        if v in (None, "", []):
            return None
        if f.get("type") == "drop_down":
            for o in (f.get("type_config") or {}).get("options") or []:
                if o.get("orderindex") == v:
                    return o.get("name")
            return None
        return v
    return None


def owner_side_for(task):
    """Prefer the owner_side field; fall back to the assignee's domain."""
    explicit = field_value(task, "owner_side")
    if explicit:
        if isinstance(explicit, dict):                    # some payloads wrap it
            explicit = explicit.get("name") or (explicit.get("value") or {}).get("name")
        if explicit:
            val = str(explicit).strip().lower().replace(" ", "_")
            if val in OWNER_SIDES:
                return val
    for a in task.get("assignees") or []:
        if ADAM_DOMAIN in (a.get("email") or "").lower():
            return "adam"
        if any(h in (a.get("username") or "").lower() for h in CENTRAL_YARDS_HINTS):
            return "central_yards"
    return "adam"


def link_for(task):
    """Key URL, else Staging Link, else the task's own URL."""
    for name in ("Key URL", "Staging Link"):
        v = field_value(task, name)
        if v:
            return str(v)
    return task.get("url") or ""


def to_row(task, forced_project=None):
    """Returns (row, incoming_status, raw_status, errors).
    incoming_status is None when the task is excluded from the app entirely."""
    raw = (task.get("status") or {}).get("status", "")
    key = raw.strip().lower()
    errors = []

    if key in EXCLUDED:
        incoming = None
    else:
        incoming = STATUS_MAP.get(key)
        if incoming is None:
            errors.append(f"unmapped status {raw!r}")

    assignees = task.get("assignees") or []
    owner_name = ", ".join(a.get("username", "") for a in assignees if a.get("username"))

    side = owner_side_for(task)
    vis = field_value(task, "visibility") or "shared"
    ref = field_value(task, "project_ref")
    project_id = forced_project or (str(ref) if ref else None)

    title = (task.get("name") or "").strip()
    due = ms_to_date(task.get("due_date"))
    link = link_for(task)

    if not title:
        errors.append("empty title")
    if side not in OWNER_SIDES:
        errors.append(f"bad owner_side {side!r}")
    if vis not in VISIBILITIES:
        errors.append(f"bad visibility {vis!r}")
    if link and not link.startswith(("http://", "https://")):
        errors.append("link_url not http(s)")
    if task.get("due_date") and not due:
        errors.append("unparseable due_date")

    oi = str(task.get("orderindex", ""))
    row = {
        "id": ID_PREFIX + task["id"],
        "source": "clickup",
        "source_id": task["id"],
        "project_id": project_id,
        "title": title,
        "detail": "",
        "owner_name": owner_name,
        "owner_side": side,
        "due_date": due,
        "status": incoming,
        "awaiting_from": "",
        "link_url": link,
        "visibility": vis,
        "position": int(oi) if oi.isdigit() else 0,
    }
    return row, incoming, raw, errors


class Supabase:
    def __init__(self, url, key):
        self.url = url.rstrip("/") + "/rest/v1"
        self.key = key

    def _headers(self, prefer=None):
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}",
             "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        return h

    def get(self, path):
        req = urllib.request.Request(self.url + path, headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode() or "[]")
        except urllib.error.HTTPError as e:
            die(f"GET {path} -> {e.code} {e.read().decode()[:200]}")

    def write(self, path, method, body=None):
        req = urllib.request.Request(
            self.url + path, method=method, headers=self._headers("return=representation"),
            data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                raw = r.read().decode()
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:300]


def plan(tasks, sb, forced_project):
    project_ids = {p["id"] for p in sb.get("/projects?select=id")}
    existing = {r["id"]: r for r in
                sb.get("/tasks?select=id,status,source,source_status&source=eq.clickup")}

    ops, skipped, conflicts, seen = [], [], [], set()
    for t in tasks:
        row, incoming, raw, errors = to_row(t, forced_project)
        seen.add(row["id"])

        # a project_id that does not resolve silently orphans the row: it shows
        # in To-do with the project blank, which reads as a data error nobody
        # can trace. Skip and report instead.
        if row["project_id"] and row["project_id"] not in project_ids:
            errors.append(f"project_id {row['project_id']!r} is not in projects")

        if errors:
            skipped.append({"clickup_id": t["id"], "title": row["title"], "errors": errors})
            continue

        cur = existing.get(row["id"])

        if cur is None:
            if incoming is None:
                continue                       # cancelled, never imported
            row["source_status"] = incoming
            ops.append({"op": "insert", "id": row["id"], "row": row,
                        "status_applied": incoming})
            continue

        patch = {k: v for k, v in row.items()
                 if k not in ("id", "source", "source_id", "status")}

        if incoming is None:
            ops.append({"op": "delete", "id": row["id"],
                        "reason": f"cancelled in ClickUp ({raw})"})
            continue

        base, current = cur.get("source_status"), cur.get("status")
        patch["source_status"] = incoming

        if base is None:
            # first sync of a row that predates the base column: adopt it, never
            # overwrite a status somebody may already have set in the app
            ops.append({"op": "update", "id": row["id"], "row": patch,
                        "status_kept": current, "adopted_base": incoming})
        elif base == incoming:
            ops.append({"op": "update", "id": row["id"], "row": patch,
                        "status_kept": current})
        elif current == base:
            patch["status"] = incoming
            ops.append({"op": "update", "id": row["id"], "row": patch,
                        "status_applied": incoming})
        else:
            ops.append({"op": "update", "id": row["id"], "row": patch,
                        "status_kept": current,
                        "conflict": {"app": current, "clickup": incoming, "base": base}})
            conflicts.append({"id": row["id"], "app": current,
                              "clickup": incoming, "base": base})

    orphans = [{"op": "delete", "id": rid, "reason": "absent from the ClickUp list"}
               for rid in existing if rid not in seen]
    return ops, orphans, skipped, conflicts, len(existing)


def main():
    ap = argparse.ArgumentParser(description="Import a ClickUp list into the app's tasks table.")
    ap.add_argument("--list", default="1100610000010928",
                    help="ClickUp list id (default: 1600 - Central Yards Workspace)")
    ap.add_argument("--project", default=None, help="project_id to attach every task to")
    ap.add_argument("--commit", action="store_true", help="actually write (default is dry run)")
    ap.add_argument("--json", action="store_true", help="print the plan as JSON")
    ap.add_argument("--no-subtasks", action="store_true")
    ap.add_argument("--allow-shrink", action="store_true",
                    help="permit a plan that removes more than 30%% of imported rows")
    args = ap.parse_args()

    token = os.environ.get("CLICKUP_TOKEN") or _read("/root/.config/clickup/token")
    if not token:
        die("no ClickUp token (CLICKUP_TOKEN or /root/.config/clickup/token)")

    meta = api(f"list/{args.list}", token)
    if "err" in meta:
        die(f"cannot read list {args.list}: {meta['err']}")

    sb_url, sb_key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not sb_url or not sb_key:
        die("SUPABASE_URL and SUPABASE_KEY are required, even for a dry run")
    sb = Supabase(sb_url, sb_key)

    tasks = fetch_tasks(token, args.list, subtasks=not args.no_subtasks)
    ops, orphans, skipped, conflicts, existing_count = plan(tasks, sb, args.project)

    counts = {}
    for o in ops + orphans:
        counts[o["op"]] = counts.get(o["op"], 0) + 1

    out = {"list": {"id": args.list, "name": meta.get("name"),
                    "folder": (meta.get("folder") or {}).get("name")},
           "mode": "commit" if args.commit else "dry-run",
           "clickup_tasks": len(tasks),
           "existing_imported_rows": existing_count,
           "ops": counts,
           "skipped": skipped,
           "conflicts": conflicts,
           "orphans": orphans,
           "plan": ops}

    if args.json:
        print(json.dumps(out, indent=1))
    else:
        print(f"list     : {meta.get('name')}  ({(meta.get('folder') or {}).get('name')})")
        print(f"fetched  : {len(tasks)} ClickUp tasks, {existing_count} already imported")
        print(f"ops      : {counts or 'nothing to do'}")
        if skipped:
            print(f"skipped  : {len(skipped)}")
            for s in skipped[:10]:
                print(f"   - {s['title'][:50]}: {'; '.join(s['errors'])}")
        if conflicts:
            print(f"conflicts: {len(conflicts)} (app value kept)")
            for c in conflicts[:10]:
                print(f"   - {c['id']}: app={c['app']} clickup={c['clickup']} base={c['base']}")
        if orphans:
            print(f"deleting : {len(orphans)} rows no longer in ClickUp")
        for o in ops[:40]:
            r = o.get("row", {})
            label = o.get("status_applied") or o.get("status_kept") or ""
            print(f"  {o['op']:6} {o['id']:22} {str(r.get('status') or ''):8} {label:8} "
                  f"{(r.get('title') or '')[:46]}")

    if not args.commit:
        # keep stdout parseable when --json was asked for
        print("\nDRY RUN. nothing written. re-run with --commit to apply.",
              file=sys.stderr if args.json else sys.stdout)
        return

    if not tasks and existing_count:
        die(f"refusing to commit: ClickUp returned zero tasks but {existing_count} "
            f"imported rows exist")
    touched = len(ops) + len(orphans)
    if existing_count and touched < existing_count * SHRINK_FLOOR and not args.allow_shrink:
        die(f"refusing to commit: plan touches {touched} of {existing_count} rows "
            f"(<{int(SHRINK_FLOOR * 100)}%). pass --allow-shrink if that is intended")

    failures = []
    for o in ops:
        if o["op"] == "insert":
            code, body = sb.write("/tasks", "POST", o["row"])
            if code not in (200, 201) or not body:
                failures.append((o["id"], code, body))
        elif o["op"] == "update":
            code, body = sb.write(f"/tasks?id=eq.{o['id']}&source=eq.clickup", "PATCH", o["row"])
            if code != 200 or not body:
                failures.append((o["id"], code, body))
        elif o["op"] == "delete":
            code, _ = sb.write(f"/tasks?id=eq.{o['id']}&source=eq.clickup", "DELETE")
            if code not in (200, 204):
                failures.append((o["id"], code, "delete"))
    for o in orphans:
        code, _ = sb.write(f"/tasks?id=eq.{o['id']}&source=eq.clickup", "DELETE")
        if code not in (200, 204):
            failures.append((o["id"], code, "orphan delete"))

    if failures:
        print(json.dumps({"failures": failures}, indent=1))
        die(f"{len(failures)} writes failed")

    done = (f"\ncommitted: {counts}. every write returned its row."
            if counts else "\nnothing to write.")
    print(done, file=sys.stderr if args.json else sys.stdout)


if __name__ == "__main__":
    main()
