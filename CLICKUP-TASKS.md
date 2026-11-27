# ClickUp tasks: connect the tracker to the Central Yards workspace

Ready to create. Each block is one task: a name, a description, and a rough
estimate. Ordered so nothing is blocked by something later in the list.

Written 25 Nov 2026. Source state: the app is live and writing to Supabase;
ClickUp and Google Sheets are not connected.

---

## 1. Issue a ClickUp API token that can see the workspace

**Why:** the personal token on the VPS (`pk_113464099...`) authenticates as
Shane but returns zero spaces — active, archived, folders and lists all empty.
`GET /list/1525` returns `401 OAECODE_027 Team not authorized`. No ClickUp work
can be automated until this is fixed.

**Do:** ClickUp → Settings → Apps → Generate API token, from an account with
access to the Central Yards space. Then confirm it works:

```bash
curl -s "https://api.clickup.com/api/v2/team/9018224189/space?archived=false" \
  -H "Authorization: <new token>"
```

A populated `spaces` array means it worked. An empty array means the account
still cannot see the space.

**Done when:** the command returns at least one space.

---

## 2. Decide the list that owns Central Yards project data

**Why:** the sync needs one source list. Right now `1525 OpenAI Consultancy` is
the list in use, but that is the OpenAI engagement and Central Yards is a
separate client. Mixing them means the app shows OpenAI tasks to Central Yards.

**Do:** create or nominate a Central Yards list, and record its id. Every task
field the app reads comes from this one list.

**Done when:** the list id is written down and agreed with Keung Gor.

---

## 3. Lock the field mapping between ClickUp and the app's tasks table

**Why:** the app reads a fixed shape. If ClickUp field names differ, the sync
writes nulls and the To-do view goes empty.

**Do:** map these to actual ClickUp custom fields:

| app column | ClickUp field | notes |
|---|---|---|
| `title` | task name | required |
| `owner_name` | assignee | display name |
| `owner_side` | custom field | `adam` / `central_yards` / `both` |
| `due_date` | due date | required for the overdue logic |
| `status` | status | must land as `open`, `doing`, `blocked` or `done` |
| `project_id` | custom field | must match a `projects.id` |
| `visibility` | custom field | `shared` / `internal`, defaults to `shared` |
| `link_url` | task URL or a link field | shown as "Open the doc" |

**Done when:** the mapping is written into this doc and the sync script.

---

## 4. Create the matching custom fields in ClickUp

**Why:** three of the app's columns have no ClickUp equivalent today.

**Do:** add custom fields to the Central Yards list: `owner_side` (dropdown),
`visibility` (dropdown), `project_ref` (text, holding the app's project id).

**Done when:** all three exist and are selectable on a test task.

---

## 5. Write the import script: ClickUp to Supabase

**Why:** the app reads `tasks` and `projects` from Supabase. It never calls the
ClickUp API at request time, deliberately: a rotated token must not blank the
site.

**Do:** a script that reads the Central Yards list and upserts into `tasks`,
keyed by `id` derived from the ClickUp task id so re-runs update rather than
duplicate. It must write `source = 'clickup'` and `source_id` so imported rows
are distinguishable from manual ones.

**Done when:** running it twice in a row leaves the same row count.

---

## 6. Import projects, not just tasks

**Why:** a task with a `project_id` that does not exist in `projects` is
silently orphaned — it shows in To-do with the project blank.

**Do:** same shape as task 5, for the project list: name, lane, tier, owner,
next action, key dates. Upsert on `id`.

**Done when:** every imported task's `project_id` resolves to a real row.

---

## 7. Schedule the sync and make it observable

**Why:** a manual sync gets forgotten and the workspace goes stale, which is
worse than not having it because people trust it.

**Do:** a cron on the VPS, every 15 minutes, writing its result somewhere
readable. On failure it must report, not fail silently.

**Done when:** a deliberately broken token produces a visible error rather than
a quiet no-op.

---

## 8. Connect the Google Sheet as the second importer

**Why:** Shane's tracker is split across ClickUp and a Sheet. Whichever holds
the truth for a given field needs defined ownership, or the two fight.

**Do:** read the Sheet via a service account, map it the same way, and decide
per-field which source wins. Write the precedence rule down.

**Done when:** editing one cell in the Sheet appears in the app after a sync.

---

## 9. Reconcile the sample data against the real import

**Why:** the database currently holds three placeholder projects and three
placeholder tasks. Once real data lands, the placeholders must not linger.

**Do:** delete the sample rows by id (`proj-1`, `proj-2`, `proj-3`, `t-1`,
`t-2`, `t-3`, and the two example quotes and decks) once the import is verified.

**Done when:** no sample row remains and the app still renders.

---

## 10. Confirm internal rows never reach the Central Yards code

**Why:** the whole point of two codes is that a draft pitch or a rough social
idea is invisible to the client until shared.

**Do:** after the real import, sign in with the Central Yards code and check
that every task, project and idea marked `internal` is absent. Then check the
database directly, because the app filters twice: once server-side by cookie
scope, and once in RLS.

**Done when:** a row marked `internal` is invisible to the client code both in
the browser and when queried with the publishable key.

---

## 11. Fix the one remaining write gap: no editing in the app

**Why:** only task status, activation dates and receipt uploads write from the
browser. Projects, ideas, quotes and decks are read-only, so someone seeing a
wrong project name has to edit Supabase directly.

**Do:** either accept it and document it, or add edit forms for projects and
quotes. Decide before handover so it is not discovered later.

**Done when:** the decision is recorded and the coworker guide is updated to
match.

---

## 12. Rotate the credentials that were shared in chat

**Why:** the service_role key, a management token and a GitHub PAT have all been
pasted into a chat thread during this build. They are compromised by exposure
regardless of who saw them.

**Do:** roll the Supabase JWT secret, revoke the management token, revoke the
GitHub PAT. Update the Vercel environment variables afterwards or uploads and
deploys break.

**Done when:** old credentials fail and the site is verified working on the new
ones.

---

## 13. Bring Keung Gor in as the orchestrator, with the VPS as the brain

**Why:** Central Yards is not the only project running. Projects need their own
focused agents that all draw on one shared brain, rather than one agent that
carries every project at once and blurs them.

**The shape wanted:**

```
Keung Gor (Discord or Telegram)      the orchestrator, the human-facing surface
        |
        v
VPS                                  the brain: memory, skills, files, credentials
        |
        +-- topic: #adam-projects   agent scoped to Adam Studios
        +-- topic: #lunacake        agent scoped to LUNA
        +-- topic: #central-yards   agent scoped to this project
        +-- ...
```

Each topic runs its own agent. Each is focused on one project, but all of them
read from the same VPS brain, so a decision recorded on one project is
available rather than lost.

**Access rule, and this is the important half:** every project agent can reach
shared storage — Google Drive, Adam Dropbox — but must not cross into another
project's context unless explicitly asked. A LUNA question should not surface
Central Yards files because the agent happened to see them.

**Do:**

1. Decide Discord or Telegram. There is already a working topic pattern on
   Telegram: `platforms.telegram.extra.dm_topics` in `/root/.hermes/config.yaml`
   maps a `chat_id` to named topics with `thread_id`s (ADORAS, FREELANCE, BRAIN
   today). Extending it is far less work than a Discord migration.
2. Create one topic per active project, and record each `thread_id`.
3. Give each topic its own scoped context: a project note, a skills filter, and
   a storage allow-list. `gateway.media_delivery_allow_dirs` is the existing
   pattern for constraining paths; do the same for Drive and Dropbox roots.
4. Write and enforce the isolation rule: a topic may read its own project's
   material by default; reaching into another project requires the request to
   name it explicitly.
5. Confirm Keung Gor can reach the orchestrator from her own account, not
   through Shane's.

**Done when:** a message in the LUNA topic cannot surface Central Yards content
unless it names Central Yards, and both topics still read the same shared
memory for things like brand rules and voice.

**Watch for:** the shared brain is the point and also the risk. Anything put in
shared memory is visible to every project agent. Client-confidential material —
Central Yards finances, OpenAI pitch material — belongs in the project scope,
not the shared one.

---

## Suggested order

1, 2, 3 and 12 first. Task 12 is independent and can run in parallel with any of
them. Tasks 5 and 6 can run together once 3 and 4 are done. Task 8 only after 7
is proven working.

Task 13 can start immediately: it does not depend on ClickUp or on the tracker
sync, and the Telegram topic pattern already exists.

Task 11 is a decision, not a build. Make it before handover.
