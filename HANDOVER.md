# Central Yards workspace, handover runbook
For Keung Gor. Everything you need to run, change and deploy this without asking Shane.

## What this is

One page workspace at one URL, behind an access code. Central Yards and ADAM both use it. Eight views: Overview, Activation map, Projects, To-do, Partnerships & Ideas, Social, Finance, Decks & Pitches.

No build step in the browser, no framework to learn. It is a single Next.js app whose only job beyond serving the page is the access gate.

## Where the files are

```
/root/central-yards/
  app/                   the whole application
    app/page.js          server entry, reads the visitor's scope
    app/login/page.js    the access code screen
    app/auth/gate/       verifies a code and sets the cookie
    app/auth/signout/    clears it
    app/components/Workspace.js   the shell, view switching, scope filtering
    app/components/views/         one file per view
    app/globals.css      all styling
    middleware.js        the gate itself
    public/config.json   brand, lanes, tier labels, statuses
    public/hk-calendar.json  holiday and recurring date layer
    public/seed.json     projects, tasks, activations, series, ideas, quotes, decks
  sql/001_schema.sql     the database schema, ready to paste into Supabase
  HANDOVER.md            this file
```

## The one rule about the data

`public/seed.json` is the local data file. Each section is a list:

- `projects` one row per project
- `tasks` one row per task, this is what the To-do views read
- `project_links` one row per Google Doc or working file
- `activations` marketing moments on the calendar
- `activation_support` links a project to an activation
- `series` Central Stories, Makers, Conversations
- `ideas` partnerships and concepts
- `social_ideas` the brain dump
- `quotes` quotations
- `decks` decks and pitches

Edit the JSON, restart, done. No database needed for the app to work.

## Visibility, how it actually behaves

Every sharable row has `visibility` set to `shared` or `internal`.

- ADAM code: sees everything.
- Central Yards code: internal rows are filtered out before the page renders, plus social ideas only appear when their status is `ready` or `shared`, and quotes only appear when confirmed.

That filtering happens server-side against the cookie scope, so a CY visitor cannot see internal rows even by reading the page source.

## Changing an access code

Codes are never stored in plaintext. Generate a new one:

```bash
python3 -c "import hashlib;n=''.join(c for c in 'MyNewCode'.lower() if c.isalnum());print('adam:cyadam7f3a:'+hashlib.sha256(('cyadam7f3a'+n).encode()).hexdigest())"
```

Change `cyadam7f3a` to `cycy7f3a` for the Central Yards code. Then set `GATE_CODES` with both entries, comma separated, in Vercel environment variables. Redeploy. Everyone's old cookie stops working when you also change `GATE_SECRET`.

## Deploying

1. `cd /root/central-yards/app`
2. `npm install` (first time only)
3. `npx next build` must print `Compiled successfully`
4. Deploy to Vercel. Project name suggested: `central-yards`.

Environment variables required in Vercel:

```
GATE_SECRET     a long random string, generate fresh for production
GATE_DAYS       30
GATE_CODES      adam:<salt>:<hash>,cy:<salt>:<hash>
```

## Adding the database later

The app works without it. When you are ready to make it multi-user and shared:

1. Create a new Supabase project. Do not reuse the Supply Co. one, that project's key is public in another site.
2. Open the SQL editor and run `/root/central-yards/sql/001_schema.sql` in one go.
3. The last statement prints row counts. If it returns numbers instead of an error, grants landed.
4. Verify each table answers over the API before wiring anything:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<project>.supabase.co/rest/v1/projects?select=*&limit=1" \
  -H "apikey: <anon key>"
```

200 means the table exists and is readable. 404 means it is not there.

5. Only then change `Workspace.js` to fetch from Supabase instead of `seed.json`. Keep `seed.json` as the fallback so a database outage does not blank the site.

## Bringing in ClickUp and Google Sheets

Neither is connected yet. The intended shape:

- ClickUp and Sheets are importers that write into `tasks` and `projects`.
- The app reads `tasks`, not the APIs directly. That way a rotated token never blanks the site.
- Run the import as a cron, verify with a read-back, and only trust it once two runs in a row agree.

The two credentials still needed:

- ClickUp: a personal API token from an account that is a member of the Central Yards space. The current token sees zero spaces.
- Google: a service account JSON with the Sheet shared to its email address, read access is enough.

## Rules from the Supply Co. build that apply here

1. Delete the row to remove something. A cleared field is not a removal.
2. Never hardcode dates in the components. Dates come from data.
3. After a data change, reload and confirm before calling it done.
4. A failure must say so on screen. No silent catch blocks.

## What is not built yet

- No editing in the browser. Data is currently edited in `seed.json` or the database directly.
- No ClickUp or Sheets sync.
- No file uploads. Links only.
- No per-person logins, two shared codes instead.
