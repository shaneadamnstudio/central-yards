#!/usr/bin/env python3
"""
Propose tags and tiers for projects and activations, from what the trackers
already say. Writes `tags_suggested` and `tier_suggested` only, never `tags` or
`tier`: a value Carol sets always wins, and this script must not be able to
overwrite her judgement.

Why it exists
  config.json has carried four tiers with colours since the first build and
  every project had `tier = null`; every activation was audience `joint` with no
  colour and no series. So the whole board rendered in one tone. This gives the
  display something to work with on day one, and gives Carol a filled-in
  suggestion to confirm or correct rather than a blank field.

How the tier is proposed
  special lane                       -> big_umbrella
  ClickUp list with 10 or more tasks -> big_ideas
  ClickUp list with 6 to 9 tasks     -> standard
  ClickUp list with 5 or fewer       -> rapid
  no ClickUp list found              -> standard

  Task counts come from the Central Yards ClickUp folder, matched to a project
  by slug. A project the tracker cannot match gets `standard` and is listed at
  the end so somebody can look at it, rather than being guessed at silently.

Usage
  python3 derive_tags.py                 # dry run, prints the table
  python3 derive_tags.py --commit

Environment
  SUPABASE_URL, SUPABASE_KEY (service role), CLICKUP_TOKEN (optional: without a
  token, tiers fall back to the lane rule)
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

FOLDER_ID = "90189621111"          # Central Yards folder
CLICKUP = "https://api.clickup.com/api/v2"

# tag by keyword. Order matters: the first match wins, so the more specific
# vocabulary sits above the general one.
TAG_RULES = [
    ("series",       ("stories", "makers", "conversations")),
    ("type",         ("type deck", "typeface", "font", "typograph", "type ")),
    ("identity",     ("identity", "brand guidelines", "brand introduction", "branding", "logo")),
    ("film",         ("film", "video", "reel", "teaser", "trailer")),
    ("social",       ("social", "instagram", "reels", "carousel")),
    ("event",        ("event", "e-invite", "invite", "launch", "opening", "activation", "party")),
    ("environment",  ("floor plan", "retail", "site", "ooh", "footbridge", "walkway", "hoarding", "signage")),
    ("collateral",   ("card", "postcard", "gift", "mahjong", "packaging", "poster", "print")),
    ("deck",         ("deck", "proposal", "powerpoint", "ppt", "pitch", "template")),
]


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def api(path, token):
    if not token:
        return {}
    req = urllib.request.Request(f"{CLICKUP}/{path}", headers={"Authorization": token})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError:
        return {}
    except urllib.error.URLError:
        return {}


class Supabase:
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
            return e.code, e.read().decode()[:200]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


def tags_for(title):
    t = (title or "").lower()
    for key, words in TAG_RULES:
        if any(w in t for w in words):
            return [key]
    return []


TOKEN_STOP = {"central", "yards", "the", "and", "for", "with", "update", "new", "2026", "2027"}


def tokens(text):
    return {w for w in re.split(r"[^a-z0-9]+", (text or "").lower()) if len(w) >= 4 and w not in TOKEN_STOP}


def clickup_sizes(token):
    """list slug -> task count, from the Central Yards folder."""
    d = api(f"folder/{FOLDER_ID}/list?archived=false", token)
    out = {}
    for l in d.get("lists", []):
        name = re.sub(r"^\d{4}\s*[-–]\s*", "", l.get("name", ""))
        out[slug(name)] = int(l.get("task_count") or 0)
    return out


def match_size(project_name, sizes):
    """Score by shared meaningful words, not by substring: the app calls it
    'cy-brand-film' and ClickUp calls it 'Central Yards Brand Film Update', and
    a substring test finds neither."""
    pt = tokens(project_name)
    if not pt:
        return None
    best, best_score = None, 1
    for k, n in sizes.items():
        shared = len(pt & tokens(k))
        if shared > best_score:
            best, best_score = n, shared
    return best


def tier_for(project, sizes):
    """Scope decides, lane only breaks a tie. Treating every special-lane
    project as big_umbrella put 17 of 31 in one bucket, which is the same as
    having no colour at all."""
    n = match_size(project.get("name"), sizes)
    if n is not None:
        if n >= 12:
            return "big_ideas", f"{n} ClickUp tasks"
        if n >= 6:
            return "standard", f"{n} ClickUp tasks"
        return "rapid", f"{n} ClickUp tasks"
    if project.get("lane") == "special":
        return "big_ideas", "special lane, no ClickUp list"
    return "standard", "no ClickUp list matched"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        die("SUPABASE_URL and SUPABASE_KEY are required")
    sb = Supabase(url, key)

    sizes = clickup_sizes(os.environ.get("CLICKUP_TOKEN"))
    projects = sb.get("/projects?select=id,name,lane,tier,tags,tags_suggested,tier_suggested")
    acts = sb.get("/activations?select=id,title,tags,tags_suggested")

    unmatched = []
    p_rows = []
    for p in projects:
        tier, why = tier_for(p, sizes)
        if why == "no ClickUp list matched":
            unmatched.append(p["name"])
        tags = tags_for(p["name"])
        p_rows.append({
            "id": p["id"],
            "tier_suggested": tier,
            "tags_suggested": tags,
            "_why": why,
            "_confirmed_tier": p.get("tier"),
            "_confirmed_tags": p.get("tags") or [],
        })

    a_rows = [{"id": a["id"], "tags_suggested": tags_for(a["title"]),
               "_title": a["title"], "_confirmed": a.get("tags") or []} for a in acts]

    print(f"projects   : {len(p_rows)}  (unmatched: {len(unmatched)})")
    print(f"activations: {len(a_rows)}\n")
    for r in p_rows[:40]:
        flag = "confirmed" if r["_confirmed_tier"] else "suggested"
        print(f"  {r['tier_suggested']:12} {flag:9} {','.join(r['tags_suggested']) or '-':12} "
              f"{r['_why'][:26]:26} {r['id'][:40]}")
    print()
    for r in a_rows[:40]:
        print(f"  {','.join(r['tags_suggested']) or '-':12} {r['_title'][:60]}")

    if args.commit:
        failures = []
        for r in p_rows:
            body = {"tier_suggested": r["tier_suggested"], "tags_suggested": r["tags_suggested"]}
            code, resp = sb.patch(f"/projects?id=eq.{r['id']}", body)
            if code != 200 or not resp:
                failures.append((r["id"], code, resp))
        for r in a_rows:
            code, resp = sb.patch(f"/activations?id=eq.{r['id']}",
                                  {"tags_suggested": r["tags_suggested"]})
            if code != 200 or not resp:
                failures.append((r["id"], code, resp))
        if failures:
            print(json.dumps({"failures": failures[:10]}, indent=1))
            die(f"{len(failures)} writes failed")
        print(f"\ncommitted: {len(p_rows)} projects, {len(a_rows)} activations")
        if unmatched:
            print("no ClickUp list matched, defaulted to standard:")
            for n in unmatched[:15]:
                print(f"  - {n}")


if __name__ == "__main__":
    main()
