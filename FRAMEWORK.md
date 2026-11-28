# Framework: brand assets and the kit of parts

Written 28 November 2026, from the Central Yards build, for the next microsite.
Two parts, one framework. Central Yards is the first tenant, not a special case.

---

## 1. Brand asset section

Every site we build carries a section holding that client's saved brand assets:
brand books, colours, guidelines, and previous work such as films and logos.

### The model

One table, `brand_assets`, with a `site_key` column. A second site is a second
`site_key`, not a second schema.

| column | meaning |
|---|---|
| `kind` | `brand_book`, `colour`, `guideline`, `video`, `logo`, `other` |
| `title`, `subtitle` | what a person reads |
| `format` | `PDF`, `MP4`, `SVG`, `Figma`, `HEX` |
| `storage_kind` | `supabase`, `drive`, `dropbox`, `link` |
| `url` | used when the file is not in our storage |
| `storage_path` | bucket key when `storage_kind` is `supabase` |
| `value` | the hex, for a colour |
| `version` | so a superseded brand book is not mistaken for the current one |
| `visibility` | `shared` or `internal`, same two values the rest of the app uses |
| `position` | order within its group |

### Why `storage_kind` exists

The canonical store is an open decision. Keeping the answer in a column means
changing it later is data, not a migration, and a site can mix stores while the
question is unsettled: films already live in Dropbox, decks in Figma, and
nothing forces those into one place on day one.

### How access works

- `supabase`: the file sits in the private `brand` bucket. `lib/workspace.js`
  mints a signed URL per request, five minutes, so a link cannot be forwarded.
- `drive`, `dropbox`, `link`: access is whatever that service says it is. The
  app cannot promise an authorised viewer will get in, only that the person who
  has access will.

That difference is why `storage_kind` is shown on the card, not hidden.

### Adding an asset

Today: a row, plus a file if it is ours.

```sql
insert into public.brand_assets
  (id, kind, title, subtitle, format, storage_kind, storage_path, visibility, position)
values
  ('ba-example-logo', 'logo', 'Primary mark', 'SVG, light and dark', 'SVG',
   'supabase', 'central-yards/logo-primary.svg', 'shared', 10);
```

The upload path for the bucket is the same shape as receipts
(`api/receipts/upload`): server-side, service key, scope checked.

---

## 2. Kit of parts

A library of blocks a site can drop in, chosen per launch. Which blocks a site
shows is a row in `site_blocks`, so a launch is a configuration decision, not a
deploy.

### The standard set

| block key | purpose |
|---|---|
| `overview` | what needs attention now: counts, next 30 days, overdue |
| `brand` | the client's brand assets: books, colours, guidelines, films, logos |
| `calendar` | the activation map, work plotted against public and school holidays |
| `projects` | the pipeline, split by lane and tier, with links and next action |
| `tasks` | the to-do list, filtered by who owes it |
| `partnerships` | partners and in-house concepts, linkable to a project or a moment |
| `social` | the social calendar and the idea backlog behind it |
| `decks` | decks and pitches, grouped by project, final one marked |
| `finance` | quotes and receipts, with private files behind signed links |
| `budget` | fees committed, invoiced and remaining against the agreed scope |

The first six cover Eugene's list: brand pillars resolve to `brand` plus the
identity text inside a brand book; timelines to `calendar`; outstanding
deliverables to `tasks` and `projects`; the budgetary summary to `budget`.

### Choosing per launch

```bash
python3 scripts/toggle_block.py                 # what is on
python3 scripts/toggle_block.py budget --on     # add a block to this site
python3 scripts/toggle_block.py social --off    # drop one
```

The app reads enabled blocks from `/api/workspace` and renders the navigation
from that list. No deploy, and no code branch per site.

### Adopting this for a second project

1. Copy `sql/009_brand_and_kit.sql`, or run it as it stands: it is generic.
2. Insert a `sites` row for the new client, and its `site_blocks` rows.
3. Point the new deployment at that site's `site_key`, or at its own Supabase
   project with the same schema.
4. Nothing in `Brand.js`, `Workspace.js` or `lib/workspace.js` names Central
   Yards, so no component changes.

---

## 3. Open decisions

Raised rather than assumed, with a recommendation each.

**Where the canonical asset store lives, and who owns upload.**
Recommendation: Supabase for anything we author and must control access to, and
links out for work already living in Drive, Dropbox and Figma. Upload owned by
the studio, because a client uploading a superseded logo into the canonical
store is a support problem nobody wants. `storage_kind` means this can change per
asset later.

**Who confirms clearance for public view.**
Recommendation: ADAM confirms, and `visibility` is the field. A client-facing
site should not be the place where "is this allowed to be seen" gets decided by
the party being seen. Same rule as internal rows elsewhere in the app: shared is
a decision, not a default.

**Which blocks are mandatory.**
Recommendation: `overview`, `brand`, `tasks` mandatory; everything else optional.
Those three answer "what is happening", "what is this brand" and "what do I owe",
and a site without them is not a site. `budget` and `finance` should be optional
by default: not every client sees money in the same tool.

---

## 4. State at 28 November 2026

Built and live on the Central Yards workspace:

- Brand assets section, grouped into six kinds, with signed links for our files
  and pass-through links for external ones
- Kit of parts with ten blocks, nine enabled and `budget` disabled, which is the
  pick-and-choose proof
- `scripts/toggle_block.py` to change the set without a deploy
- This document

Not yet supplied, and visible as empty groups rather than hidden:
**logos and a brand book for Central Yards.** They need the licensed files from
the studio or the client. No Central Yards palette exists to publish either:
`DECISIONS.md` records that the brand is Adam's, with no CY palette to ask for.
