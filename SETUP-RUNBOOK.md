# Central Yards workspace — setup runbook

For the ADAM agent taking this over. Everything below is verified against the live
system as of 25 November 2026, not recalled from notes.

Repo: `github.com/shaneadamnstudio/central-yards`
Live: `https://central-yards.vercel.app`

---

## 0. What you are picking up

A Next.js 14 app, JavaScript (not TypeScript), served on Vercel, storing data in
Supabase. Nothing else. No CMS, no ORM, no auth service.

```
central-yards/
  app/                       the application
    app/page.js              server entry, reads the access-code scope
    app/layout.js            metadata, favicon, fonts
    app/globals.css          the entire design system, one file
    app/components/
      Workspace.js           shell, view switching, scope filtering
      Masthead.js            the shared page header
      useReveal.js           staggered card entrance
      useWrite.js            client-side write helper
      views/                 one file per tab
        calDates.js          date helpers for the calendar
    app/api/
      workspace/route.js     reads all tables
      state/route.js         task status and activation placement writes
      receipts/route.js      lists receipts, mints signed URLs
      receipts/upload/route.js  accepts a file, stores it, writes the row
    lib/
      workspace.js           Supabase reads
      store.js               Supabase writes, with read-back
    public/
      config.json            lanes, tier labels, statuses
      hk-calendar.json       Hong Kong holiday and recurring date layer
      seed.json              sample content (no editable state)
      icon.svg               the Adam "A" favicon
      wordmark-path.js       the Adam wordmark path data
      fonts/Geist.ttf, GeistMono.ttf
    middleware.js            the access-code gate
  sql/                       five files, applied in order
```

---

## 1. Prerequisites

- Node 18 or newer (built and tested on Node 26)
- A Supabase project
- A Vercel project linked to the repo
- Nothing else. No CLI needed if you use the dashboard.

Package versions that are known good:

```
next                       14.2.35    (pinned: earlier 14.2.x have a CVE)
react / react-dom          18.3.1
@supabase/supabase-js      ^2.119.2
@supabase/ssr              ^0.12.7
```

---

## 2. Supabase

### 2.1 Create the project

New project, do not reuse another client's. Every table carries a permissive
read policy for the Central Yards side and the publishable key ships in the
browser, so a shared project means one client can read another's financials.

### 2.2 Apply the SQL, in this order

Run each file whole in the SQL Editor, or POST it to
`https://api.supabase.com/v1/projects/<ref>/database/query` with a management
token (`sbp_...`) in the Authorization header. That endpoint is the only one
that runs DDL; a service-role key cannot, and neither can PostgREST.

| order | file | what it does |
|---|---|---|
| 1 | `sql/002_live_schema.sql` | 11 tables, enums, indexes, RLS, grants |
| 2 | `sql/003_seed.sql` | sample content, all upserts, safe to re-run |
| 3 | `sql/004_anon_writes.sql` | column-level UPDATE for the two writable fields |
| 4 | `sql/005_receipts.sql` | the `finance` storage bucket and `receipts` table |
| 5 | `sql/006_anon_hardening.sql` | **existing databases only.** Revokes the old blanket grant from `anon`. Skip on a fresh build: 002 already grants read-only. |
| 6 | `sql/007_write_path.sql` | **existing databases only, and only after the deploy that moves writes server-side.** Removes anon's last two UPDATE grants. |

`sql/001_schema.sql` is an earlier draft. Do not run it; 002 supersedes it.

**Each file ends with a `select` that prints row counts. If it returns numbers
rather than an error, the grants landed.** If it says `permission denied`, the
grants are missing and every role will fail at runtime.

### 2.3 Tables

| table | rows now | purpose |
|---|---|---|
| `projects` | 3 | the pipeline, with lane, tier, owner, next action |
| `project_links` | 2 | Google Docs and working files per project |
| `tasks` | 3 | the to-do list both teams read |
| `activations` | 1 | marketing moments on the calendar |
| `activation_support` | 4 | which projects support which activation |
| `series` | 3 | Central Stories, Makers, Conversations |
| `ideas` | 2 | partners and in-house concepts |
| `social_ideas` | 2 | the brain dump |
| `quotes` | 2 | quotations with reviewer and status |
| `decks` | 2 | deck and pitch links |
| `receipts` | 0 | filed receipts and invoices |

`calendar_dates` also exists but is currently unused: the Hong Kong calendar
lives in `app/public/hk-calendar.json`, not the database. If you move it into
the table, delete the JSON so the same dates cannot live in two places.

### 2.4 Access model, and the one thing that will bite you

The app authenticates with the **publishable (anon) key**, because the login
gate is Next middleware, not Supabase Auth. So RLS is the only real protection.

Current state, verified against the live project:

```
anon          SELECT on all 12 tables. Nothing else: no INSERT, no UPDATE,
              no DELETE, no TRUNCATE.
authenticated full access
service_role  full access
```

Writes do not use the browser key. A tick and a calendar drag post to
`/api/state`, which runs on the server with the service key and checks the
caller's scope per row in `lib/store.js`. That is why `anon` needs no write
grant, and why this section is shorter than it used to be.

Row visibility is a separate gate, applied by RLS on top of those grants, and it
is not uniform:

```
projects, project_links, tasks, activations, ideas, social_ideas, decks
              visibility = 'shared'
quotes        visibility = 'shared' AND status = 'confirmed'
activation_support, calendar_dates, series
              no filter: USING (true) on read
```

Scope is enforced in `lib/store.js`, not by RLS, because the server writes with a
key RLS does not filter. A Central Yards session gets `visibility = 'shared'`
rows only, and a write against an internal row is refused with the row named.
The read path does the same in `lib/workspace.js`, which fails closed: an unknown
or missing scope is treated as the client's.

Two things have broken this before, and both are worth checking after any SQL
change:

- **A table-level grant overrides a column-level one.** 002 once granted
  `insert, update, delete` on every table to `anon`; 004 then narrowed it to two
  columns, and the narrowing did nothing because the table-level privilege was
  still there. The public browser key could rewrite any column of any row it
  could see. `006_anon_hardening.sql` fixes an existing database; 002 is fixed
  for new ones.
- **TRUNCATE is not subject to RLS.** It arrives with Supabase's default grants
  on the public schema, not from anything in these files, so an `anon` key that
  holds it can empty a table with one request. Both 002 and 006 revoke it
  explicitly.

Writes used to depend on `sql/004_anon_writes.sql`, which granted anon two
columns. That file is now superseded on the write path, and its grants are
removed by `007_write_path.sql`. The failure mode it guarded against is still
worth knowing: a PostgREST update with no matching grant returns **HTTP 200 with
zero rows affected**, which looks like success and changes nothing. Every write
in `lib/store.js` reads the row back for exactly that reason. Check it with:

```bash
# allowed: anon holds UPDATE on tasks.status. A row that does not exist gives
# 200 with []. A missing privilege gives 401 with 42501, so this distinguishes
# "no such row" from "grant missing" even on an empty table.
curl -s -w '|%{http_code}\n' -X PATCH "$URL/rest/v1/tasks?id=eq.none" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
  -d '{"status":"done"}'

# denied: a column anon may not write must answer 401 42501
curl -s -w '|%{http_code}\n' -X PATCH "$URL/rest/v1/tasks?id=eq.none" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"title":"x"}'
```

Read those two answers together. `200 []` on the first and `401 42501` on the
second mean the access model is intact. `200 []` on the second means the blanket
grant is back and `006_anon_hardening.sql` needs running. Never test this with
`id=eq.t-1`: those sample rows no longer exist, and an absent row returns the
same empty array as a missing grant.

### 2.5 Storage

Bucket `finance`, **private**, 10 MB limit, accepting PDF, JPEG, PNG, WebP,
HEIC, TIFF, XLSX, XLS.

It must stay private. Receipts carry amounts and supplier names, and the anon
key is public. Files are served through signed URLs that expire in 300 seconds,
generated per request in `app/api/receipts/route.js`.

---

## 3. Vercel

Import the repo. **Set the Root Directory to `app`** — the Next app is not at
the repo root and the build fails without this.

Environment variables, all scoped to **Production** (and Preview if you want
preview deploys to work):

```
NEXT_PUBLIC_SUPABASE_URL               https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY              eyJ...            (server only, never NEXT_PUBLIC_)
GATE_SECRET                            any long random string
GATE_DAYS                              30
GATE_CODES                             adam:<salt>:<hash>,cy:<salt>:<hash>
```

Two traps, both of which cost time on the first build:

1. **`NEXT_PUBLIC_*` is frozen at build time.** Adding or editing one does
   nothing to an existing deployment. You must redeploy.
2. **Do not prefix the service key with `NEXT_PUBLIC_`.** That would inline a
   full-access key into the browser bundle.

`/api/env-check` reports which expected variables the running deployment can
see, by presence and length only. It never returns a value. Use it before
guessing between a typo, a wrong scope and a stale build. Remove the route
before this goes anywhere public-facing.

### Generating the access codes

Codes are stored as salted SHA-256, never in plaintext.

```bash
python3 -c "import hashlib;n=''.join(c for c in 'YOURCODE'.lower() if c.isalnum());print('adam:cyadam7f3a:'+hashlib.sha256(('cyadam7f3a'+n).encode()).hexdigest())"
```

Use `cycy7f3a` in place of `cyadam7f3a` for the Central Yards code. Changing
`GATE_SECRET` also signs everyone out, which is the way to revoke access when a
code leaks.

The cookie carries the scope (`adam` or `cy`). The middleware reads it and sets
an `x-cy-scope` header; `Workspace.js` filters internal rows against it before
render. A Central Yards visitor never receives internal rows at all.

---

## 4. Running locally

```bash
cd app
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

Before shipping anything, `npx next build` must print `Compiled successfully`.
It is worth running even in dev-only work, because JSX structure errors surface
there and not always in the dev server.

---

## 5. The rules this codebase follows

These came from the Supply Co. build and are not optional. Breaking one has
already caused bugs on this project.

**Delete the row to remove something.** A cleared column is not a removal once
a merge ignores empty values. Absence is the state.

**Never seed a value the database also owns.** `seed.json` deliberately carries
no `status` and no `start_date`. When a value lives in both places the seed wins
the merge and removal becomes impossible. For the same reason there is no
fallback to `seed.json` when tables are missing: the app names the missing table
and fails.

**A write must prove it landed.** `lib/store.js` updates, selects the row back,
and throws unless the stored value matches. Never trust `res.ok`.

**A route that reads current state must not be cached.** Every route here is
`force-dynamic`, `revalidate = 0`, `fetchCache = 'force-no-store'`, and the
Supabase client fetches with `cache: 'no-store'`. A cached read makes a
successful write look lost.

**A failure must say so.** No silent catch blocks. Writes surface in the chrome;
uploads return the reason.

**Verify presence and visibility separately.** Counting DOM nodes proves an
element exists. It does not prove a person can see it. Check the screenshot.

---

## 6. Known gaps

- **No editing in the browser.** Projects, ideas, quotes and decks are read-only
  in the UI. Content is changed in Supabase or via the tracker sync. Only task
  status, activation placement and receipt uploads write from the page.
- **ClickUp and Google Sheets are not connected.** Tasks and projects are
  currently sample data. The intended shape is described in `HANDOVER.md`:
  both importers write into `tasks` and `projects`, and the app reads those
  tables rather than calling either API live, so a rotated token cannot blank
  the site.
- **2028 holidays are absent.** gov.hk has not gazetted them; the 2028 page
  returns 404. Add dates to `hk-calendar.json` when published and the year
  appears automatically, because the calendar derives its year range from the
  data.
- **No per-person accounts.** Two shared codes, not logins.
- **`calendar_dates` table is unused** — see 2.3.

---

## 7. Verifying a deploy before you call it done

Four checks, in order, because each fails in a different layer and the UI is
unreliable evidence for all four.

```bash
# 1. the app answers and the gate runs
curl -s -o /dev/null -w "%{http_code}\n" https://central-yards.vercel.app/

# 2. the tables are reachable with the publishable key
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<ref>.supabase.co/rest/v1/tasks?select=id&limit=1" \
  -H "apikey: $ANON"

# 3. a write is permitted, with the app's own key: 200 [] on a row that does not
#    exist. A missing grant answers 401 42501 instead.
curl -s -w '|%{http_code}\n' -X PATCH "https://<ref>.supabase.co/rest/v1/tasks?id=eq.none" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
  -d '{"status":"done"}'

# 4. a column anon may not write is refused: expect 401 42501
curl -s -w '|%{http_code}\n' -X PATCH "https://<ref>.supabase.co/rest/v1/tasks?id=eq.none" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' -d '{"title":"x"}'
```

Then in a browser: sign in with each code and confirm the Central Yards code
cannot see internal rows. Tick a task, reload, confirm it stayed ticked. Upload
a receipt and confirm the signed URL opens it.

---

## 8. Handover notes

`HANDOVER.md` covers the tracker sync design and the file-by-file data model.
`COWORKER-GUIDE.txt` is the plain-language version written for the client side.

If you change a shared value: change it in one place, reload with the browser
copy cleared, and confirm it came back from the server. That test is the only
proof the change is shared rather than local.
