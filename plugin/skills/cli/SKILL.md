---
name: cli
description: "BLOCKING: read this BEFORE running any `codello` command or writing any jq over its output — the field names are NOT guessable and a wrong guess returns empty, which reads as \"no such session\" and is a false negative. Triggers: any mention of a Codello/PTY/agent session on this machine, a session or conversation or transcript id, \"which session/agent did this\", \"what is that session doing\", \"is anything waiting on me\", listing/finding/reading sessions, or grepping ~/.claude/projects by hand. Covers: mapping a conversation id to its session (and back), reading a session without attaching, triaging what needs the user."
---

# Codello CLI

`codello` runs a local server on this machine that owns every Codello session (each
one a PTY, usually running `claude` or `codex`) and relays it to the user's phone and
browser. The CLI is the read/write surface for that server.

**Start here for any session question:** `codello sessions --json` — one call, machine
readable, and it carries the id mapping that makes everything else possible.

```bash
codello sessions --json
```

```json
[
  {
    "id": "b6899618-ef6a-4813-9936-e25f46e6c3db",
    "shortId": "b6899618",
    "state": "working",
    "rawState": "tool_execution",
    "displayName": "Qa brenda",
    "cwd": "/Users/eric/src/hourglass",
    "agentSessionId": "f077f7c8-f298-4792-b0ae-35c6dfb2c9ec",
    "stateSinceIso": "2026-07-31T14:22:46.993Z",
    "createdAt": "2026-07-30T19:18:01.109Z",
    "hostConnected": true,
    "clientCount": 0,
    "needsAttention": false,
    "type": "terminal"
  }
]
```

Prefer `--json` over the human listing in every automated read: the plain output is
`[codetogo] `-prefixed and reflowed (the CLI's own prefix has not been renamed yet), so parsing it is strictly worse.

**Those are all the field names there are.** Do not guess one. `jq` on a field that does
not exist prints nothing and exits 0, which looks exactly like "no session matches" — so a
guessed key does not fail loudly, it fabricates a false negative. The plausible-sounding
names that do **not** exist: `conversationId`, `claudeSessionId`, `sessionId`, `agentId`,
`name` (it's `displayName`), `title`, `dir`, `status` (it's `state`). If a lookup comes back
empty, re-read the field list above before concluding the session isn't there.

## The two ids — read this before anything else

Every session has **two** unrelated uuids, and mixing them up is the single most common
way to waste turns here:

| Field | What it is | Where it's valid |
|---|---|---|
| `id` / `shortId` | The **PTY / Codello session** id | `codello tail`, `viewers`, `connect`, `copy --session`, `logs --session`, the `?session=` deep link |
| `agentSessionId` | The **agent conversation** id (Claude Code / Codex) — names the transcript on disk | `~/.claude/projects/*/<id>.jsonl`, `claude --resume <id>`, `~/.codex/sessions/**/*-<id>.json` |

They are **not** interchangeable and neither command falls back to the other:

```bash
codello tail f077f7c8-f298-4792-b0ae-35c6dfb2c9ec   # ✗ "No session matching ..."
codello tail b6899618                               # ✓ (PTY id — prefixes are fine)
codello logs search --session <PTY-id>               # ✓ needs the FULL PTY uuid, not a prefix
```

`agentSessionId` is the **current** binding, not history. A session that was restarted or
`compact`ed has a new agent id; its older ids are only in the resume snapshot
(see "Older / dead sessions" below).

## Recipes

Every `jq` below assumes the bare-array shape above.

**Which session produced this work?** (transcript id → the live session, its title and dir).
This is the reverse lookup that makes "which agent wrote that commit" a one-liner instead
of a transcript grep:

```bash
AG=f077f7c8-f298-4792-b0ae-35c6dfb2c9ec
codello sessions --json | jq -r --arg a "$AG" \
  '.[] | select(.agentSessionId==$a) | "\(.shortId)  \(.displayName)  \(.cwd)"'
```

**Is anything waiting on the user?** — the triage question:

```bash
codello sessions --json | jq -r \
  '.[] | select(.state=="waiting-on-you" or .state=="blocked-on-you" or .state=="error")
   | "\(.shortId) \(.state) \(.displayName) — \(.cwd)"'
```

**What's running in a given project?**

```bash
codello sessions --json | jq -r --arg d "$PWD" \
  '.[] | select(.cwd==$d) | "\(.shortId) \(.state) \(.displayName) agent=\(.agentSessionId)"'
```

**What did a session just say?** — reads the transcript off disk; does **not** attach,
steal the PTY, or disturb the session:

```bash
codello tail <pty-id-prefix>            # last 3 assistant messages
codello tail <pty-id> -n 10 --max-lines 0   # more turns, untruncated
```

Prints the title, cwd, and `claude|codex <agentSessionId>` header, so it doubles as a
PTY-id → agent-id lookup for one session. Works for Claude and Codex sessions alike.

**What ran in this session BEFORE the current conversation?** — a `/clear` starts a new
conversation and a new transcript with no back-reference to the one it replaced, so the
shared PTY is the only link and Codello is the only thing holding it:

```bash
codello history                          # this session ($CODELLO_SESSION), 5 most recent
codello history <pty-id-prefix> --json   # another session, machine-readable
codello tail <pty-id> --agent <agent-session-id>   # read one of them
```

Each row carries the agent, when it was last active, its opening ask, its last message, and
the transcript path. `--all` includes the conversation running right now, which is excluded
by default. Prefer **`/codello:continue`** over driving this by hand — it picks the
conversation and reads both ends for you.

**Transcript path from an agent id** (for reading raw JSONL yourself). Claude Code
replaces every char outside `[a-zA-Z0-9-]` in the cwd with `-`:

```bash
# ~/.claude/projects/<cwd with non-alnum → ->/<agentSessionId>.jsonl
ls ~/.claude/projects/-Users-eric-src-hourglass/$AG.jsonl
# Codex instead: ~/.codex/sessions/**/rollout-<date>-<agentSessionId>.json
```

**Open a session on the user's phone/browser** — the `serverId` for the link lives in
`~/.codetogo/auth.json`:

```bash
SRV=$(jq -r .serverId ~/.codetogo/auth.json)
codello sessions --json | jq -r --arg s "$SRV" \
  '.[] | "\(.displayName): https://codello.app/terminal?server=\($s)&session=\(.id)"'
```

**Other reads:** `codello status` (login, server pid/port, cloud latency, all sessions
with deep links) · `codello viewers [pty-id]` (who's watching + the PTY size, and the
per-viewer sizes that explain a clamped width) · `codello logs search "<text>" --since 1h`
(central logs across CLI, cloud, and relay — the user's phone has no console, so this is
the only way to see client-side logs).

## Reading `state`

`state` is a derived, coarse verdict — use it, not `rawState`, for decisions:

- `working` — actively thinking/streaming/running a tool.
- `waiting-on-you` — a permission prompt or a fired attention signal. **Act on this.**
- `blocked-on-you` — finished its turn on an unanswered question. Silent otherwise, so
  this is the one that hides sessions stuck since Friday.
- `idle` — at a prompt, nothing pending.
- `error` / `dead` — errored, or the host side is gone.
- `unknown` — **no detector for this session**, not "fine". Its state was wiped (e.g. by
  a server restart) and nothing has re-established it, so it may well be parked on
  something. Don't report `unknown` as idle.

`stateSinceIso` is the last state *change* (null = never transitioned), not the time of
your call — so "working for 4 hours" is a real, computable signal. It is **UTC**; convert
before showing the user a time.

## Acting on the session you're running inside

An agent running inside a Codello session has `CODELLO_SESSION` set to its own **PTY
id**, and these commands target that session implicitly — no id argument:

```bash
codello rename "Fix flaky auth test"    # retitle this session in the user's list
codello snooze [until-wake|1h|4h|8h|clear]  # stop surfacing this session as waiting
codello copy --md notes.md              # rich text → the clipboard of the device viewing this session
codello copy --md notes.md --session <pty-id>   # ...or aim it at another session
```

`snooze` is for when you've armed a wait Codello can't see — a cron, a CI run, a promised
follow-up — so the session doesn't sit in the user's list looking like it needs them.

The commands that report on the task itself also target this session implicitly, and each
has its own skill with the rules for when to run it:

```bash
codello session-status set waiting -m "Review PR #12"   # this turn ends needing the user (skill: waiting)
codello session-status clear                             # the wait ended without them replying
codello done -m "Merged the retry fix"                   # finished, nothing left for the user (skill: done)
codello done --failed -m "Staging DB unreachable"        # could not be done (skill: done)
codello quit                                             # the user said "do X and quit" and X succeeded (skill: quit)
codello secret list                                      # names of the credentials this session holds (skill: secrets)
codello secret request GITHUB_TOKEN --reason "Deploy"    # ask for a credential without it entering the chat (skill: secrets)
TOKEN="$(codello secret get GITHUB_TOKEN)"               # use a held credential; only ever inside $(…) (skill: secrets)
```

`session-status set waiting` exists because a session with a `Monitor`, a background
`Bash`, or a dev server still running reads as `working` to every inference above, so a
turn that ends on "PR ready for review" is never surfaced. The declaration outranks the
inference (`state` becomes `waiting-on-you`), carries the `-m` line as `declaredMessage`,
and is retired by the user's reply, `clear`, or `done`.

Outside a Codello session `CODELLO_SESSION` is unset and these exit 1 with "Not in a
Codello session" — that's the honest answer, not a bug to work around. `copy` is the one
exception: `--session <pty-id>` overrides the env var, so it works from anywhere.

**`codello notify "deploy finished"` is NOT one of these.** It pushes to the user's
devices account-wide, reads no session id at all, and works fine outside a session — so
don't reach for `CODELLO_SESSION` before calling it.

Related, and covered by this plugin's own slash commands rather than raw CLI: **`/codello:spawn`**
(start new titled sessions, one per task), **`/codello:schedule`** (fire a pre-seeded
session later), **`/codello:copy`**, **`/codello:handoff`** · **`/codello:resume`** ·
**`/codello:compact`** · **`/codello:fresh`** · **`/codello:continue`**. Prefer those over
hand-rolling `codello spawn` / `schedule add` / `history`.

## Older / dead sessions

`sessions --json` lists only what's **live now**. For a session that has since ended,
read the snapshots the server writes (`~/.codetogo/snapshots/`, also `codello resume
--list`):

```bash
codello resume --json | jq -r '.sessions[]
  | select(.agentSessionIds[]? | startswith("019fb34f"))
  | "\(.name)  \(.cwd)  \(.agentType)"'
```

Unlike the live row, snapshot entries keep **`agentSessionIds` as a list** — every agent
conversation that PTY ever hosted — so this is the only place a pre-restart or
pre-compact agent id can still be resolved to a project.

## Hazards

- **Don't hand an `agentSessionId` to a PTY-id command** (or the reverse). Both fail as
  "not found", which reads as "that session doesn't exist" and sends you off grepping.
- **Prefixes:** `tail` / `viewers` / `connect` accept an unambiguous PTY-id prefix and
  name the collisions when there are several. `logs search --session` does **not** —
  it silently returns "No logs found" for a prefix. Pass the full uuid.
- **Read-only vs. intrusive:** `sessions`, `tail`, `viewers`, `status`, `logs` are safe on
  a session someone is using. `codello connect` **attaches your terminal to a live PTY**
  and, with no argument, auto-selects when there's exactly one session — never reach for
  it to "just look"; `tail` is the read.
- **Never run bare `codello stop`** to fix something. It kills every PTY on the machine
  and cuts the user off from their phone. `codello restart` preserves sessions. To close
  one session, run `codello stop <session-id>` (full id or unique prefix): it closes only
  that session, which stays reopenable from the app. It needs a CLI whose
  `codello spawn --help` lists `--prompt-file`; an older CLI reads the id as a request to
  stop the server.
- **`codello logs` reads *production* by default** even while you're testing elsewhere;
  each line carries a `prod`/`stg` badge. Tag the environment before drawing conclusions.
- **`sessions --json` exits 1 with `{"error":"server-not-running"}`** when the server is
  down — check the exit code, and don't misread the empty listing as "no sessions".
- **All timestamps are UTC.** Convert to the user's local zone before showing them.
- **`--json` needs CLI ≥ 1.2.32** (`codello -V`). On an older CLI the flag is rejected;
  `codello upgrade` is the fix.
- **When the Bash sandbox is on, run every `codello` command with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach. Sandboxed, they all fail the same way, which looks like a dead server and is not `server-not-running`.
