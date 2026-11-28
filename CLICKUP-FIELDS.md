# ClickUp field mapping for the Central Yards importer

Written 28 November 2026. Source list and status mapping are approved. This
records the three app fields the importer needs, their exact specification, and
the identifier for every field that already exists on the list.

Status: **field creation is blocked on permissions.** The token belongs to
Shane Long (shane@adamstudios.xyz) and can create and update tasks, but
`POST /v2/list/{id}/field` returns:

```
User does not have permission to create fields in this location
```

Creating custom fields needs workspace-admin rights. Everything else the
importer needs already works, verified with a probe task that was deleted.

---

## The three fields to create

| app field | ClickUp name | type | options / format |
|---|---|---|---|
| `owner_side` | `owner_side` | `drop_down` | `adam`, `central_yards`, `both` |
| `visibility` | `visibility` | `drop_down` | `shared`, `internal` |
| `project_ref` | `project_ref` | `text` | the app's project id, e.g. `sheet-compliment-cards` |

Names are lowercase snake_case to match the app's column names exactly, so the
mapping needs no translation table later.

### Creation calls

```bash
LIST=1100610000001008

curl -X POST "https://api.clickup.com/api/v2/list/$LIST/field" \
  -H "Authorization: $CLICKUP_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"owner_side","type":"drop_down","type_config":{"options":[
       {"name":"adam","color":null,"id":"1"},
       {"name":"central_yards","color":null,"id":"2"},
       {"name":"both","color":null,"id":"3"}]}}'

curl -X POST "https://api.clickup.com/api/v2/list/$LIST/field" \
  -H "Authorization: $CLICKUP_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"visibility","type":"drop_down","type_config":{"options":[
       {"name":"shared","color":null,"id":"1"},
       {"name":"internal","color":null,"id":"2"}]}}'

curl -X POST "https://api.clickup.com/api/v2/list/$LIST/field" \
  -H "Authorization: $CLICKUP_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"project_ref","type":"text","type_config":{}}'
```

ClickUp assigns the field ids. Read them back afterwards and paste them into
the table below.

---

## Field identifiers already on list 1517

These exist now. The importer uses two of them instead of asking for new ones:
`Key URL` and `Staging Link` are url-type and carry `link_url`.

| name | type | field id |
|---|---|---|
| `BASELINE_duration` | multi_key | `00acdec2-4702-467d-9246-abeb962b7381` |
| `BASELINE_due_date` | multi_key | `3e55d96e-28f9-4f33-81fa-381047260c72` |
| `Progress` | automatic_progress | `684a6aa1-2527-415a-9d4c-f228e7175fb6` |
| `Role` | labels | `75075aba-1dbb-4ef4-8e28-accd4fd1a9bd` |
| `BASELINE_status` | multi_key | `78218c87-7c67-4a0b-80a8-66f0f94bddcf` |
| `Client Due Date` | date | `9204d6c0-4295-4331-b962-bcad383455af` |
| `BASELINE_start_date` | multi_key | `9f06d0bf-9b84-467f-9bdc-acef03255f23` |
| `Key URL` | url | `a70fbc9e-aa1e-4310-beee-53ffbe78af54` |
| `Staging Link` | url | `f0c010f9-02b1-4115-a562-d76ddc5587ef` |

## Field identifiers to fill in after creation

| name | type | field id |
|---|---|---|
| `owner_side` | drop_down | _pending_ |
| `visibility` | drop_down | _pending_ |
| `project_ref` | text | _pending_ |

---

## What the importer does until those fields exist

It runs. `owner_side` is inferred from the assignee email domain (an
`@adamstudios` assignee reads as `adam`), `visibility` defaults to `shared`, and
`project_ref` is left empty. That means the app cannot tell an Adam-only item
from a Central Yards one, so internal drafts would appear to the client.

**Until the fields exist, do not share the Central Yards view with anyone
outside ADAM.** The `cy` access code filters on `visibility`, and without the
field every imported task reads as shared.

Once the fields are created, the importer reads them directly with no code
change: it looks up by field name, so the ids only need recording here for
reference and for any raw API work.
