# Reply to Keung Gor, and what the bot actually needs

Written 27 November 2026 after testing her claims directly rather than accepting
them.

---

## The bot has access. Verified, not assumed.

Her first line — "do you already have access to this?" — the answer is **yes**,
and it is worth recording that I previously reported the opposite. The token on
this box returns `{"spaces":[]}` from the space listing endpoint, which I read as
"no access". That was wrong: it is a listing quirk. Direct object reads work.

Tested just now with the same token she is describing:

```
GET  /v2/folder/90189621111          -> Central Yards, 27 lists, task_count 52
GET  /v2/list/1100610000001008       -> 1517 - Central Yards App & Digital Experience
POST /v2/list/1100610000001008/task  -> 201, task created
POST /v2/task/{id}/field/{field}     -> 200, custom field written
PATCH/read-back                      -> status, due date and custom field all persisted
DELETE /v2/task/{id}                 -> 204
```

So read and write both work, including custom fields. The two probe tasks were
deleted; 1517 is back to zero tasks.

**Correction to her note:** 1517 does have custom fields. Not the ones the
importer needs, but nine exist:

```
BASELINE_duration, BASELINE_due_date, BASELINE_start_date, BASELINE_status,
Progress, Role, Key URL, Staging Link, Client Due Date
```

That matters because `Key URL` and `Staging Link` are both `url` type and can
carry the app's `link_url` without creating anything new. Only `owner_side`,
`visibility` and `project_ref` genuinely have to be added.

---

## Answer to her two questions

### 1517 or a new 1600?

**1517.** Not because it is empty, but because of what it is named and what the
other 26 lists contain.

Every other list in that folder is a client deliverable: Compliment Cards,
Mahjong Tile Re-Order, Powerpoint Template, Milestone Film, Retail Floor Plans,
Chairman Vision Campaign Video. They are things Adam makes *for* Central Yards.
1517 is the only list named for a digital experience rather than a physical or
campaign output, which is consistent with it being the workspace itself.

Her concern is the right one though, and it should be answered rather than
waved away: **if 1517 turns out to be a product Adam is building for Central
Yards, do not use it.** Mixing tracker tasks into a deliverable pollutes the
deliverable and the client sees both. One question to Shane settles it, and he
should answer before the importer is written, not after.

### Should `cancelled` read as done, or be hidden?

**Hidden.** Not done, not open.

ClickUp types `cancelled` as `done` alongside `done` and `Closed`, so a naive
`type == done` filter silently counts abandoned work as complete. That is the
same class of error as the zero-rows write: it looks right and is wrong.

In the app, cancelled work should simply not appear. Excluded, not mapped.

---

## The status mapping, explicit

Her suggested mapping is nearly right. One correction and one addition.

| ClickUp status | ClickUp type | app status | note |
|---|---|---|---|
| `project artifact` | open | `open` | |
| `to do` | unstarted | `open` | |
| `planning` | custom | `open` | |
| `in progress` | custom | `doing` | |
| `internal review` | custom | `doing` | |
| `client review` | custom | `doing` | |
| `revise` | custom | `doing` | **not** `open`: revisiting delivered work is active |
| `blocked` | custom | `blocked` | |
| `hold` | custom | `blocked` | parked work is not progress |
| `done` | done | `done` | |
| `Closed` | closed | `done` | |
| `cancelled` | **done** | **excluded** | typed done by ClickUp; must be filtered, not mapped |

**The correction:** she put `revise` in the `doing` group and that is right, but
it is worth naming because `revise` under a `type == done` filter would be
counted as complete if ClickUp ever retypes it.

**The trap to avoid:** mapping on `type` rather than `status` name. With this
vocabulary, `type` collides: three statuses share `custom`, and `cancelled`
shares `done` with genuine completion. Map on the status **name**.

---

## What the bot needs to finish this

Nothing from Keung Gor. Everything below is on the app side and is already
possible.

1. **Create three custom fields on 1517**: `owner_side` (labels:
   adam / central_yards / both), `visibility` (labels: shared / internal),
   `project_ref` (text). Reuse `Key URL` for `link_url`.
2. **Write the importer against 1517**, mapping on status name using the table
   above, excluding `cancelled`.
3. **Dry run**: read 1517, print the would-be rows, write nothing.
4. **Then a real run** once Shane confirms 1517 is the workspace and not a
   client deliverable.
5. **Delete the sample rows** in Supabase (`proj-1..3`, `t-1..3`) when the real
   import is verified.

One thing the bot still cannot do, unrelated to ClickUp: read or set the Central
Yards Vercel environment variables, because the Vercel token on this box is
scoped to a different account. That does not block the importer, but it does
block confirming the production deployment.

---

## What to send back to her

> Yes, I have access to folder 90189621111 and to 1517. Verified read and write,
> including custom fields — two probes created and deleted, 1517 is clean.
>
> Going with 1517, pending Shane confirming it is the workspace rather than a
> client deliverable. If it is a deliverable, we use a new 1600 instead.
>
> `cancelled` is excluded from the app, not mapped to done. ClickUp types it as
> `done`, so we map on status name rather than type.
>
> One correction: 1517 does have nine custom fields, including `Key URL` and
> `Staging Link` which we can reuse for links. Only owner_side, visibility and
> project_ref need creating.
>
> Status mapping is written out in full. `revise` → doing, `hold` → blocked.
>
> Building the importer in dry run against 1517 now.
