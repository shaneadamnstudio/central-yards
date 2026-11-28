#!/usr/bin/env python3
"""
Turn blocks of the kit of parts on and off for a site, without a deploy.

A launch decision is a row in `site_blocks`, so choosing which blocks a
microsite shows is data. This is the CLI for that row.

Usage
  python3 toggle_block.py                              # list, with state
  python3 toggle_block.py brand --on                   # switch a block on
  python3 toggle_block.py budget --off                 # switch it off
  python3 toggle_block.py budget --on --site central-yards

Environment
  SUPABASE_URL, SUPABASE_KEY   service role
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BLOCKS = {
    "overview":     "what needs attention now: counts, next 30 days, overdue",
    "brand":        "the client's brand assets: books, colours, guidelines, films, logos",
    "calendar":     "the activation map, work plotted against public and school holidays",
    "projects":     "the pipeline, split by lane and tier, with links and next action",
    "tasks":        "the to-do list, filtered by who owes it",
    "partnerships": "partners and in-house concepts, linkable to a project or a moment",
    "social":       "the social calendar and the idea backlog behind it",
    "decks":        "decks and pitches, grouped by project, final one marked",
    "finance":      "quotes and receipts, with private files behind signed links",
    "budget":       "fees committed, invoiced and remaining against the agreed scope",
}


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


class SB:
    def __init__(self, url, key):
        self.url = url.rstrip("/") + "/rest/v1"
        self.key = key

    def _h(self, prefer=None):
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}",
             "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        return h

    def get(self, path):
        req = urllib.request.Request(self.url + path, headers=self._h())
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode() or "[]")
        except urllib.error.HTTPError as e:
            die(f"GET {path} -> {e.code} {e.read().decode()[:200]}")

    def patch(self, path, body):
        req = urllib.request.Request(self.url + path, method="PATCH",
                                     headers=self._h("return=representation"),
                                     data=json.dumps(body).encode())
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.status, json.loads(r.read().decode() or "[]")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()[:300]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("block", nargs="?", help="block key to change")
    ap.add_argument("--on", action="store_true")
    ap.add_argument("--off", action="store_true")
    ap.add_argument("--site", default="central-yards")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        die("SUPABASE_URL and SUPABASE_KEY are required")
    sb = SB(url, key)

    rows = sb.get(f"/site_blocks?site_key=eq.{args.site}&order=position") or []
    state = {r["block_key"]: r["enabled"] for r in rows}

    if not args.block:
        print(f"site: {args.site}")
        for r in rows:
            mark = "on " if r["enabled"] else "off"
            purpose = BLOCKS.get(r["block_key"], "")
            print(f"  [{mark}] {r['block_key']:<14} {purpose}")
        return

    if args.block not in state:
        die(f"unknown block {args.block!r}; known keys: {', '.join(sorted(state))}")
    if not (args.on or args.off):
        die("pass --on or --off")

    want = bool(args.on)
    code, body = sb.patch(f"/site_blocks?site_key=eq.{args.site}&block_key=eq.{args.block}",
                          {"enabled": want})
    if code != 200 or not body:
        die(f"write failed: {code} {body}")
    print(f"{args.block}: {'on' if want else 'off'} (verified by read-back)")


if __name__ == "__main__":
    main()
