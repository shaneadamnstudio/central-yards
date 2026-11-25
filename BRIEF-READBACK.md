# Central Yards build brief, read-back
From Shane, 25 Nov 2026. Source: Supply Co. microsite build as the design reference.

## The core idea

One shared workspace for ADAM and Central Yards. Activations, projects, tasks, quotes, decks and ideas all in one place, on one calendar, with clear ownership and clear internal/shared visibility. Supply Co. is the visual and structural reference, not the content.

## Eleven areas

### Shell and design
1. Supply Co. aesthetic and navigation carried over: clean, simple, easy to scan.
2. Two programme lanes: **General Central Yards Projects** (ongoing) and **Special Projects** (standalone, leading into 2027).

### The calendar
3. **2027 activation map.** Central Yards marketing activations and ADAM's related work on one calendar. Per activation: key dates, which projects support it, and where ADAM can pitch into it.
4. **Holiday layer.** Hong Kong public holidays from a maintained calendar, plus recurring dates set once a year that carry forward automatically. Toggle the layer on and off.
5. **Recurring series.** Central Stories, Makers and Conversations need grouping so editorial work reads against the bigger marketing moments as dates firm up.

### Projects and tracker
6. **Existing project tracker is the starting point.** Google Docs and working files linked to each project. Shared place for ADAM and Central Yards to add links and update status, owner, key dates, next action. Carry over the **Rapid, Standard, Big Ideas, Big Umbrella** labels.
7. **To-do views.** Switch between Everyone, Central Yards and ADAM. Each task shows owner, due date and related project. Pulled from the shared tracker so a task is updated once.
8. **Upcoming and awaiting review on the homepage.** Milestones plus what each team owes next. Example given: Conversations feedback shows who owes the action, when it is due, and a direct link to the feedback doc.

### Separate pages
9. **Partnerships & Ideas.** Potential partners and in-house ADAM concepts for Central Yards: product/object ideas, events, activations. An idea can link to a relevant project or marketing moment.
10. **Social.** ADAM brain-dump, content themes, and how the Central Yards brand builds on social over time. Selected ideas can be shared with the client when ready.
11. **Finance.** Quotations and invoices. Each quote links to its project, shows the current quote link, who is reviewing it, and status: **Submitted, Reviewed, Confirmed, On Hold**.
12. **Decks & Pitches.** One index of deck and pitch links grouped by project, current deck easy to spot. The same link surfaces inside the project.

### Additions
13. **Internal and shared visibility.** ADAM can mark a pitch, rough social idea or draft quotation as internal before Central Yards sees it. Visibility is explicit at the point of adding or sharing.

## Decisions I need from you before build

1. **Where is the existing project tracker?** ClickUp, a Google Sheet, Notion, or a doc? The whole to-do and project layer depends on whether we read it live or migrate it in. This is the one blocking answer.
2. **Is Central Yards' brand available?** Supply Co. used black, eggshell and tan with Diatype. If Central Yards has its own palette and type, I need it or I am guessing.
3. **What is the access model?** Supply Co. was one shared code in a cookie. Central Yards needs per-team visibility (ADAM internal vs shared with Central Yards), so this becomes two gate codes at minimum, or real logins. My recommendation is two codes: one ADAM, one Central Yards, with internal items simply not rendered for the Central Yards code. No passwords to manage, works today.
4. **Hong Kong public holidays, 2027.** The HK government publishes the 2027 general holidays. I pull them once and store as data. Do you want only published public holidays, or also things like school holidays, typhoon signal behaviour and Lunar New Year run-up weeks?
5. **How many projects are live right now?** I need a starter set so the pipeline, to-do views and homepage are not empty on day one.

## Supabase answer

Two projects, not one.

- Copy the 6 Supply Co. tables into a new project for Central Yards. Same schema plus the new tables below.
- Reason: every table has a permissive read policy and the anon key ships in the page, so anyone viewing source can read every row. Sharing `awghzghypadciopxdcad` means Central Yards could read Supply Co.'s pipeline, quotes and internal notes.
- Supply Co. stays exactly as it is, untouched.

New or extended tables, all needing grants in the same batch as the create:

| table | purpose |
|---|---|
| `collabs` | carried over, plus `lane` set to general or special |
| `projects` | name, status, owner, key dates, next action, tier label, lane, links[] |
| `project_links` | one row per link, typed doc/deck/quote/folder, so Google Docs attach cleanly |
| `tasks` | owner side (adam/cy), owner name, due date, project, status, visibility |
| `activations` | 2027 marketing moments: date range, series link, supporting project ids, pitch room flag |
| `activation_support` | join table, activation to project |
| `series` | Central Stories, Makers, Conversations: name, cadence, colour, parent activation |
| `calendar_dates` | recurring dates set once, RRULE plus an override table for the year |
| `ideas` | partnerships and in-house concepts, with `link_to_project` and `link_to_activation` |
| `social_ideas` | brain dump, theme, status, visibility |
| `quotes` | project_id, amount, currency, link, reviewer, status enum |
| `decks` | project_id, title, link, is_current |
| `visibility` | shared enum used by every sharable table |
| `drop_moves` | carried over, programme drops |

## Build order

1. New Supabase project, schema, grants. Verify each table returns 200 before any code.
2. Fork `site/index.html`. Strip OpenAI content. Keep the six-view shell and the card/calendar/kanban machinery.
3. Rebuild the JSON to Central Yards data. Nulls are fine, empty views are honest.
4. Calendar first, because the activation map is the centre of the brief. HK holidays plus recurring dates plus series.
5. Projects and tracker with links. Then to-do views. Then homepage review strip.
6. Finance, Decks, Social, Partnerships pages.
7. Visibility layer last, but wired from the start so nothing has to be retrofitted.
8. Gate with two codes. Verify with a wiped browser between every check, per the Supply Co. rules.

## Rules carried over from Supply Co.

- Delete the row to remove something; a cleared column is not a removal.
- Never seed dates into the code.
- Write, then read back with local storage wiped before calling it done.
- Copy the rebuilt index.html into deploy/public/ and grep it.
- A failure must say so, never a silent catch.
