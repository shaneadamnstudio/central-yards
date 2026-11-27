# Access status: what the agent has and what it needs

Written 27 November 2026. Each point below was tested against the live systems,
not assumed. Where your note and my test disagree, the test result is listed
with the command that produced it.

---

## 1. Vercel — CONFIRMED BLOCKED

**Your note:** no token, cannot read or set env vars, redeploy, or see build logs.

**Test result: partly correct, and the reason is narrower than "no token".**

A token exists on the box at `/root/.config/vercel/token` (60 chars, `vcp_`
prefix). It authenticates:

```bash
curl -s "https://api.vercel.com/v9/projects" -H "Authorization: Bearer $TOKEN"
# returns: ["supply-co-research"]   only
```

So the token works, but the **Central Yards project is not visible to it**. It
lives under a different Vercel account or team. That is the actual blocker: not
a missing token, a token scoped to the wrong account.

**What this prevents:** reading or setting env vars on the Central Yards
project, triggering a redeploy, reading build logs. Confirmed — none of these
can be done for that project from this box.

**On `/api/env-check`:** your note says it sits behind the gate so it cannot be
read externally. That is correct, and it is the only reason the diagnostic has
limited use. It was reached during this build by driving a real browser session
with the access code, not by an external HTTP call. If you want an agent to read
it directly, it needs either the gate cookie or to be excluded from the matcher.

**What is needed:** a Vercel token from the account that owns the Central Yards
project, or the project moved to the account the current token can see.

---

## 2. GitHub — CONFIRMED PARTLY AVAILABLE

**Your note:** repo reads anonymously but cannot push or open a PR.

**Test result: same symptom, different cause.**

The PAT **on disk** at `/root/.config/github/token` returns `Bad credentials`
from the GitHub API. It is dead.

The PAT **used during this build** — passed in the session, never written to
disk — authenticates as `shaneadamnstudio` and reports `"push": true` on
`shaneadamnstudio/central-yards`. Every commit in this project was pushed with
it.

So: **pushing is possible today, but only with a token that is not persisted and
was pasted into a chat thread.** That token should be revoked, which is why it
should not be relied on.

**What is needed:** a fresh PAT written to `/root/.config/github/token`, scoped
to the repo, supplied outside chat. Note the repo owner is `shaneadamnstudio`
(a personal account), not `shanelong89-rgb` where Vercel's GitHub integration
is installed — which is why Vercel could not import it without a manual step.

---

## 3. ClickUp — CONFIRMED BLOCKED, and your note is more accurate than my earlier read

**Your note:** token is fine, decision is not made; there is a Central Yards
folder with 27 lists and none owns the app data.

**Test result: your read of the folder confirms access I could not get. My
earlier conclusion was wrong.**

I reported that the token sees zero spaces. That is what the API returns:

```bash
curl -s "https://api.clickup.com/api/v2/team/9018224189/space?archived=false" -H "Authorization: $TOKEN"
# {"spaces":[]}
curl -s "https://api.clickup.com/api/v2/team/9018224189/folder?archived=false" -H "Authorization: $TOKEN"
# {"folders":[]}
curl -s "https://api.clickup.com/api/v2/list/1525" -H "Authorization: $TOKEN"
# 401 ECODE OAUTH_027 Team not authorized
```

Given you can see 27 lists in a Central Yards folder, the token is not the
problem in the way I described. The likelier reading is that the token belongs
to a member who is not in that space, so the API filters everything out
silently rather than erroring.

**What this prevents:** creating the 13 tasks from `CLICKUP-TASKS.md`
programmatically.

**What is needed:** either the token's user added to the Central Yards space, or
a token from an account already in it, plus the decision on which of the 27
lists owns app data (task 2 in `CLICKUP-TASKS.md`).

---

## 4. Google — CORRECTION: this is available, and better than you thought

**Your note:** Google Sheet id and service-account share — nothing yet.

**Test result: a working user token already exists and can read Drive.**

`/root/.hermes/google_token.json` holds a refresh token for
**shane@ (Shane Long)**. It refreshes successfully and carries:

```
drive, spreadsheets, documents, calendar,
gmail.modify, gmail.readonly, gmail.send, contacts.readonly
```

That is full Drive and Sheets access. No service account is needed for reading;
the existing user token will do.

**What it can currently see:** searching Drive for spreadsheets returns only
one — `LUNA — Chocolate Launch Weekend (27–28 Nov)`. No spreadsheet named
"Central Yards" is visible to this account.

**What this means:** the blocker is not credentials, it is that the Sheet is
either not created yet, not shared with Shane's account, or named something that
does not contain "Central Yards". Point the agent at the Sheet id (or a name to
search for) and it can read it immediately with the existing token.

A service account also exists at `/root/cultive-ga4/service-account.json` but
belongs to another project; do not reuse it here.

**One caveat:** a user token acts as Shane. If the sync should survive a
password change or a revoked session, a service account shared to the Sheet is
the more durable arrangement. For getting started, the user token is enough.

---

## Summary

| item | status | what is actually needed |
|---|---|---|
| Vercel | blocked | token from the account that owns the Central Yards project |
| GitHub | works, but on a token that should be revoked | fresh PAT stored on disk, supplied outside chat |
| ClickUp | blocked | token user added to the Central Yards space, plus the list decision |
| Google | **available** | the Sheet id, or a searchable name; existing token will read it |

Two corrections to earlier statements in this thread: the ClickUp token is not
simply unauthorised in the way I first reported, and Google reading does not
need a service account.

---

## Precise list of what to supply

1. **Vercel token** for the account owning the Central Yards project — or move
   the project to the account the current token already sees.
2. **GitHub PAT**, scoped to `shaneadamnstudio/central-yards`, delivered outside
   chat, saved to `/root/.config/github/token`.
3. **ClickUp** — the user behind the token added to the Central Yards space, and
   the id of the list that will own app data (one of the 27).
4. **Google Sheet** — either its id, or its exact name if it is shared with
   shane@. Nothing else is needed for read access.
