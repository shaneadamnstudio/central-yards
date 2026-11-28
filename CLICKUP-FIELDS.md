# ClickUp field mapping for the Central Yards importer

Verified 28 November 2026 against the live list. This supersedes the earlier
version of this file, which said field creation was blocked on permissions. It
is not: the three fields exist, created under the Keung Gor seat.

**Source list:** `1100610000010928`, `1600 - Central Yards Workspace`, inside the
`Central Yards` folder. Not `1517`: that list is a client deliverable, and the
app spans all of them.

---

## The three app fields

| app column | ClickUp field | type | field id |
|---|---|---|---|
| `owner_side` | `owner_side` | `drop_down` | `9f22d2f6-b06b-446e-a9ae-ebf828a7f2dd` |
| `visibility` | `visibility` | `drop_down` | `90b70b89-9ffa-4ba5-9b96-e9abadc95ec0` |
| `project_id` | `project_ref` | `text` | `11c45cc6-1098-483e-8f8f-8e29e98e3ee7` |

Option ids, needed when writing a value:

```
owner_side    adam           59a9550a-e65e-46bf-8e0d-d07c83225cae
              central_yards  bece726f-91e5-47bc-8081-bac8c52e5f97
              both           035b1e00-759b-4bef-9365-50611bf0126f

visibility    shared         151c117a-a4a3-43dc-96b5-3da6116eff0f
              internal       c15a1a01-0186-4c87-a6b2-1a196e5320d2
```

Names are lowercase snake_case so the app's column names match, with one
exception: the ClickUp field is `project_ref` because it holds the app's project
id, which is not the same thing as the ClickUp project.

---

## The one quirk that costs an afternoon

**Writes take the option id, reads return the option's `orderindex` as an
integer.** `central_yards` comes back as `1`, `internal` as `1`. The options also
live on the task's own `custom_fields` entry, not on the list's field schema, so
resolving against the schema alone returns `None` and then falls through to a
default, which looks like a mapping that works and is silently wrong.

Key on the option **name** as the source of truth, map name to id on the way in,
and map orderindex back to name on the way out.

---

## Read the fields back

```bash
LIST=1100610000010928
curl -s "https://api.clickup.com/api/v2/list/$LIST/field" \
  -H "Authorization: $CLICKUP_TOKEN" | python3 -m json.tool
```

## If a field ever has to change

The ClickUp API can create a custom field but cannot update or delete one:
`PUT` and `DELETE` on a field both return `405`. Creating is therefore one-way
through the API, so get the name and the options right first. Changing an option
means a human edits it in the ClickUp UI.
