# Access status: what the agent has and what it needs

Updated 27 November 2026, after Shane supplied the Sheet link. Each point was
tested against the live systems. Where my test result contradicts an earlier
statement in this thread, the test result is what to trust.

---

## 1. Google — RESOLVED. The Sheet is readable now.

**Sheet:** `AS x CY | Project Status & Deliverables Tracker`
**Id:** `1Sc8M3duaRU8POZ3izTYnD5J-0WveJb3PXoQa-FAPrjI`
**Owner:** carol (not Shane). Shared with Shane's account, which is why the
existing token can read it.

The token at `/root/.hermes/google_token.json` refreshes and carries `drive`,
`spreadsheets`, `documents`, `calendar` and gmail scopes. No service account is
needed for reading. This was previously reported as "not available" — that was
wrong. It was available; the Sheet simply had not been identified.

**Four tabs, and they are not a single flat task list:**

| tab | non-empty rows | what it holds |
|---|---|---|
| `[WIP] 2027 SOW` | 23 | 2027 tentative scope, by priority, with target month and next steps |
| `ONGOING TASKS / PROJECTS` | 17 | live work, dated, with status and links |
| `COMPLETED PROJECT & DELIVERABLES SUMMARY` | 24 | finished work, for reference |
| `SOCIAL MEDIA` | 4 concept blocks | month, post, date, notes, action, status |

**Column shape, `ONGOING TASKS / PROJECTS`:**
`PROJECTS & TASKS` | `DATE` | `STATUS & NEXT STEPS` | `STATUS` | `SOURCE` | `LINKS`

**Column shape, `SOCIAL MEDIA`:**
`MONTH` | `POST` | `DATE` | `NOTES` | `ACTION` | `STATUS`

**What this changes about the sync design.** The Sheet is not a clean task table.
It is a log: many rows share one project name by leaving the first column blank,
and each row is an update rather than a task. Mapping it straight onto `tasks`
would produce one task per historical email line.

The realistic mapping:

- `ONGOING TASKS / PROJECTS` → `projects` plus `project_links`.
  Each project block becomes one project row, and the links column becomes
  `project_links` rows. The dated status lines belong in the project's notes or
  an activity feed, not as tasks.
- `[WIP] 2027 SOW` → `projects` with `next_action` and
  `next_action_due`, since the target month and next step are already there.
- `SOCIAL MEDIA` → `social_ideas`.
- `COMPLETED ...` → archive only. Do not import as live work.

**Access needed to write back:** the token is Shane's, and Carol owns the file.
Writing to the Sheet from the agent would post as Shane. If the agent should
edit it, confirm that is acceptable, or share it to a dedicated service account
instead.

---

## 2. Vercel — still blocked, and it is a scope problem not a missing token

A token exists at `/root/.config/vercel/token` (60 chars, `vcp_` prefix). It
authenticates, but:

```bash
curl -s "https://api.vercel.com/v9/projects" -H "Authorization: Bearer $TOKEN"
# returns: ["supply-co-research"]  only
```

The Central Yards project is not visible to it. It is under a different Vercel
account or team.

**Prevents:** reading or setting env vars on Central Yards, triggering a
redeploy, reading build logs.

**Needed:** a Vercel token from the account owning the Central Yards project, or
move that project to the account this token already sees.

**On `/api/env-check`:** it does sit behind the gate, so an external HTTP call
cannot read it. It was used during this build by driving a real browser session
with the access code. If an agent needs it directly, either pass the gate cookie
or exclude the path from the middleware matcher.

---

## 3. GitHub — works, but only on a token that should be revoked

The PAT **on disk** at `/root/.config/github/token` returns `Bad credentials`.
It is dead.

A PAT pasted into the chat during this build authenticates as `shaneadamnstudio`
and reports `"push": true` on `shaneadamnstudio/central-yards`. Every commit in
this project was pushed with it. It is not persisted anywhere.

**Needed:** a fresh PAT, scoped to that repo, written to
`/root/.config/github/token`, supplied outside chat.

Note the repo owner is `shaneadamnstudio`, a personal account, not
`shanelong89-rgb` where Vercel's GitHub integration lives. That mismatch is why
Vercel could not import the repo without a manual step.

---

## 4. ClickUp — blocked, and my earlier diagnosis was too simple

The ClickUp API returns empty for everything:

```bash
curl -s "https://api.clickup.com/api/v2/team/9018224189/space?archived=false" -H "Authorization: $TOKEN"
# {"spaces":[]}
curl -s "https://api.clickup.com/api/v2/list/1525" -H "Authorization: $TOKEN"
# 401 ECODE OAUTH_027 Team not authorized
```

Shane reports a Central Yards folder holding 27 lists, none of which owns the
app data. Given that folder is visible in the ClickUp UI, the token is not
dead — the likeliest explanation is that its user is not a member of that
space, so the API filters results out silently rather than erroring.

**Needed:** the token's user added to the Central Yards space, and a decision on
which of the 27 lists owns app data (task 2 in `CLICKUP-TASKS.md`).

---

## Summary

| item | status | what is actually needed |
|---|---|---|
| Google Sheet | **resolved, readable** | nothing to supply; reading works now |
| Vercel | blocked | token from the account owning the Central Yards project |
| GitHub | works on a soon-to-be-revoked token | fresh PAT stored on disk, supplied outside chat |
| ClickUp | blocked | token user added to the Central Yards space + the list decision |

---

## Next step, and it is a real decision not a task

The Sheet is readable, so the tracker sync can start now without waiting on
ClickUp. But the Sheet is a status log, not a task table, so the mapping in
section 1 has to be agreed before code is written. Importing it literally would
fill the To-do view with historical email lines.

Two questions for Shane:

1. Should `ONGOING TASKS / PROJECTS` become projects with links (my
   recommendation), or genuinely become tasks?
2. Should the agent write back to the Sheet, given it would post as Shane on a
   file Carol owns?
