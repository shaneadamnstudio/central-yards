# Multi-project agent topology

Keung Gor as orchestrator, the VPS as the brain, and one scoped agent per
project topic.

Written 25 November 2026. Grounded in the system that is running today, not a
proposal for a new one.

---

## 1. The shape

```
        Keung Gor                    human-facing surface
     Discord or Telegram
             |
             v
          the VPS                    the brain: one memory, one skill library,
                                     one set of credentials and files
             |
   +---------+---------+---------+
   |         |         |         |
#adam-    #lunacake #central-  #<next
projects            yards       project
   |         |         |
   v         v         v
 scoped    scoped    scoped
 agent     agent     agent
```

Each topic runs its own agent. Each agent is focused on one project. All of them
read from the same VPS brain, so a decision recorded once is available
everywhere rather than trapped in the thread it was made in.

The orchestrator is the only surface Keung Gor talks to. She does not need to
know which bot is behind which topic.

---

## 2. What already exists

This is an extension, not a new build. Verified on this box:

| piece | state | where |
|---|---|---|
| Topic routing | **working** | `platforms.telegram.extra.dm_topics` in `/root/.hermes/config.yaml` |
| Topics defined today | ADORAS, FREELANCE, BRAIN | `thread_id` 58896, 58900, 58904 |
| Shared memory | working | `/root/.hermes/memories/MEMORY.md` and `USER.md` |
| Skill library | working, ~60 skills | `/root/.hermes/skills/` |
| Path allow-listing | working | `gateway.media_delivery_allow_dirs` |
| Agent relay | working | `agent_relay.targets` (the Mac agent) |

The `dm_topics` block is the exact mechanism for what is being asked. Adding a
project topic is one entry:

```yaml
platforms:
  telegram:
    extra:
      dm_topics:
        - chat_id: 6577653053
          topics:
            - name: ADAM-PROJECTS
              icon_color: 7322096
              thread_id: <new>
            - name: LUNACAKE
              icon_color: 9367192
              thread_id: <new>
            - name: CENTRAL-YARDS
              icon_color: 13338331
              thread_id: <new>
```

---

## 3. The access rule

Every project agent can reach shared storage — Google Drive, Adam Dropbox — but
must not cross into another project's context unless the request names it.

Concretely:

- A question in `#lunacake` may read LUNA files by default.
- It may not surface a Central Yards document because the agent happened to
  index it.
- Reaching across is allowed only when the request is explicit: "compare this to
  the Central Yards deck" is a named request and should work.

**Not crossing means not reading, not just not showing.** An agent that reads
everything and then declines to mention it has still put the material in its
context, where a later summarisation or a memory write can leak it.

---

## 4. How to enforce it, using what the VPS already does

Four levers, in order of how much they actually constrain:

**1. Storage scope per topic.** `media_delivery_allow_dirs` already restrains
which paths a channel may receive files from. Apply the same shape to Drive and
Dropbox roots: a topic's agent gets its project's root plus the shared brand
root, and nothing else.

**2. Skill filter per topic.** The skill library is global today. A project
topic needs its own allow-list so a Central Yards agent is not loading LUNA
pricing skills and vice versa. `supabase-schema-and-cms-build` is the kind of
skill that is useful to all three; `luna-pricing-and-launch` belongs to one.

**3. Memory split.** This is the one that matters most and is easiest to get
wrong. See section 5.

**4. Explicit cross-project grant.** When a cross-project read is wanted, it
should be a deliberate act — a named handoff — not a side effect of shared
storage. Worth recording when it happens, so "why does LUNA know about Central
Yards" has an answer.

---

## 5. The risk: one brain is also one leak

A shared brain is the point of this design and its main hazard. Today
`/root/.hermes/memories/MEMORY.md` is injected into every session. Anything
written there is visible to every project agent, forever, unless removed.

That is fine for brand rules, voice, and how Shane works. It is not fine for:

- Central Yards finances, quotes, receipts
- OpenAI pitch material and partner research
- LUNA supplier costs and margins
- Anything under an NDA

**Rule:** client-confidential material belongs in that project's scope, never in
shared memory. Shared memory holds who the user is, standing conventions, and
environment facts — nothing that would embarrass a client if it surfaced in the
wrong thread.

There is a second, subtler version of the same risk. Summaries and compression
can promote a project-specific fact into a general one. A per-topic agent with a
narrow scope makes that far less likely than one agent that has seen everything,
which is a real argument for this design rather than against it.

---

## 6. Discord or Telegram

**Telegram is the cheaper path** and I would take it.

Telegram already has the topic routing, the topic IDs, the gateway, and Keung
Gor's access pattern. Adding three topics is a config edit.

Discord would mean a new bot, a new gateway path, and rebuilding the topic
routing that already works. It buys richer threading and roles, which may matter
later if the team grows well beyond two people. It is not worth paying for now.

If Discord is wanted regardless, the same scoping rules apply; only the
transport changes.

---

## 7. Build order

1. Create the three topics, record the `thread_id`s (config edit, minutes).
2. Confirm Keung Gor can reach the topics from her own account, not Shane's.
3. Write the per-topic storage allow-list, starting with `#central-yards`.
4. Write the per-topic skill allow-list.
5. Move any client-confidential facts out of shared memory into project scope.
6. Test the isolation rule in both directions: a LUNA question must not surface
   Central Yards material, and a named cross-project request must still work.

---

## 8. How to know it works

**Isolation.** In `#lunacake`, ask something only Central Yards documentation
would answer. The agent should say it does not have that in scope. Then ask
"read the Central Yards opening brief and compare it" — that is a named request
and should succeed.

**Shared brain.** Record a decision in `#adam-projects`. Ask for it in
`#central-yards`. It should be there, because brand and working-style facts are
shared by design.

**No leakage via memory.** After a week of use, search `MEMORY.md` for client
names and figures. Nothing confidential should be in it.

**Access.** Keung Gor signs in as herself and reaches every topic without using
Shane's credentials.

---

## 9. Open decisions

- Discord or Telegram — recommendation above is Telegram.
- Does Keung Gor get her own bot identity, or post into the existing DM topics
  as a participant? The second is simpler and preserves the topic structure;
  the first is cleaner if her access needs to be revocable independently.
- Which projects get a topic now. Three is a reasonable start; a topic per
  client will not scale indefinitely, and inactive projects should be archived
  rather than left running.
- Whether cross-project reads should be logged. I would log them, at least
  initially, because the isolation rule is harder to trust without evidence.
