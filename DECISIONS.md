# Central Yards, decisions locked
25 Nov 2026. Supersedes the open questions in BRIEF-READBACK.md.

## Locked

1. **Tracker source.** ClickUp and Google Sheets both exist. Neither is accessible from this box yet (see blockers). The app must not assume either as the only truth, so the integration point is built as an adapter: ClickUp tasks and Sheet rows both normalise into one `tasks` table. Once one is connected, the other can follow without touching the UI.
2. **Brand.** Adam Studios brand: black #000000, eggshell #f5f1e9, tan #a08967, Diatype (Geist as the open stand-in). No Central Yards palette, none to ask for.
3. **Access.** Two gate codes: one ADAM, one Central Yards. Internal-flagged items are not rendered for the CY code. Cookie model as per Supply Co., extended with a `scope` claim so the server knows which code was used, not just that a code was valid. Two codes only, no passwords.
4. **Calendar layer.** HK published public holidays, plus school holidays, plus typhoon signal behaviour, plus Lunar New Year run-up. All in one togglable layer, each sub-layer independently toggleable.
5. **Starter data.** The Google Sheet provides the first projects and tasks. Until it arrives the pipeline and to-do views ship empty with a clear "no projects yet" state rather than sample data.

## Who this is for

Built by Shane as a webdev deliverable for a coworker. After handover it goes to **Keung Gor** on the Adam Studios ClickUp/VPS side, who needs working access to the Google Docs. That changes two things:

- Every link must be a real URL that works for someone with Drive access, not a local reference.
- Handover needs a runbook Keung Gor can follow without asking questions: where the repo is, how to deploy, how to change a gate code, how to add a project.

## Blockers, both on credentials

**ClickUp.** Token at `/root/.config/clickup/token` authenticates as Adam Studios but has no access to any space: `GET /team/9018224189/space` returns an empty list, and `GET /list/1525` returns `401 ECODE OAUTH_027 Team not authorized`. It appears to be a personal token for a user who is not a member of the spaces we need. Fix: either add that user to the Central Yards space, or issue a new personal API token from an admin account (ClickUp > Settings > Apps > Generate).

**Google.** No Google credentials on this box at all: no gws CLI, no service account, no OAuth store. Reading a Sheet needs one of:
- a service account JSON with the Sheet shared to its email (read-only is enough for the starter data), or
- an OAuth client plus a one-time consent, or
- the Sheet exported as CSV and dropped in the workspace.

Any of the three works. The service account is the cleanest for a long-lived integration.

## Architecture decision

`tasks` is the single table the to-do views read from. ClickUp and Sheets are importers, not the live source, unless you want live two-way sync later. This matters for Keung Gor: a mirrored table she can read and correct is more predictable than a live API dependency that breaks when a token rotates. Sync can be added as a cron once the mirror is trusted.

## Open, non-blocking

- Number of live projects, once the sheet lands.
- Whether Keung Gor needs write access to the app itself or only to the Docs behind it.
- Whether ADAM internal items should be invisible to the CY gate or visible-but-labelled. Currently built as invisible.
