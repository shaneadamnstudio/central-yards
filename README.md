# Central Yards x Adam Studios

A shared workspace for Central Yards and Adam Studios. Marketing activations, projects,
tasks, pitches, quotes and ideas in one place, behind an access code.

## Views

- **Overview** upcoming milestones, and what each team owes next
- **Activation map** the 2027 calendar, with holiday and recurring date layers on top
- **Projects** the pipeline, in two lanes, with the Rapid / Standard / Big Ideas / Big Umbrella labels
- **To-do** one list, filterable by Everyone, ADAM or Central Yards
- **Partnerships & Ideas** partners and in-house concepts, linkable to projects and activations
- **Social** ADAM's brain dump and content themes, shareable when ready
- **Finance** quotations with a reviewer and a status
- **Decks & Pitches** one index, current deck marked

## Running it

```bash
cd app
npm install
cp .env.example .env.local   # then fill in GATE_SECRET and GATE_CODES
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

## Access codes

Two codes, one per team: `adam` and `cy`. Codes are stored as salted SHA-256, never in
plaintext. The cookie carries the scope, so the server knows which team signed in and
filters internal items before the page renders.

`adam` sees everything. `cy` never receives internal rows: internal projects, tasks,
links, ideas and non-confirmed quotes are removed server-side, and social ideas only
appear once marked `ready` or `shared`.

## Data

The app runs off `app/public/seed.json`. No database is required.

| key | what it holds |
|---|---|
| `projects` | one row per project |
| `tasks` | what the To-do views read |
| `project_links` | Google Docs and working files |
| `activations` | marketing moments on the calendar |
| `activation_support` | which projects support which activation |
| `series` | Central Stories, Makers, Conversations |
| `ideas` | partners and concepts |
| `social_ideas` | the brain dump |
| `quotes` | quotations |
| `decks` | decks and pitches |

`app/public/hk-calendar.json` holds the Hong Kong calendar layer: gazetted general
holidays, school periods, Lunar New Year run-up, and the typhoon working rules.

## Database, when you are ready

`sql/001_schema.sql` creates the full schema for a new Supabase project. Run it in one
go in the SQL editor. The closing statement prints row counts; if it returns numbers
rather than `permission denied`, the grants landed.

Do not point this at an existing project whose key is already public in another site.

## Handover

`HANDOVER.md` covers deploying, changing a code, adding the database, and the intended
ClickUp and Google Sheets import shape.
