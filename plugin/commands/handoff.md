---
description: Write a handoff so another agent — or a fresh Codello session — can continue this work
argument-hint: "[path] | quick"
---

Write a `HANDOFF.md` that lets ANY AI coding agent pick up this work with no memory of
this chat. Inside a Codello-owned session you can instead reset context *in place* with
`/codello:compact` (writes the same handoff, then hot-swaps the `claude` process under the
live session) — reach for that when the context is polluted, not merely long.

## 1. Gather state

```bash
git status && git diff --stat && git log --oneline -5
echo "cc/$CLAUDE_CODE_SESSION_ID"      # source transcript id (for aii) — omit if empty
echo "$CODELLO_SESSION"                # the Codello session id, if this is one
# Monitors and background Bash tasks this session started and never saw finish.
INV="${CLAUDE_PLUGIN_ROOT:-}/scripts/background-inventory.sh"
[ -f "$INV" ] || INV=$(find "$HOME/.claude/plugins" -maxdepth 7 -name background-inventory.sh -path "*codello*" 2>/dev/null | sort -V | tail -1)
[ -n "$INV" ] && [ -f "$INV" ] && bash "$INV"
```

Then mine the conversation for: the goal, what's done, **what was tried and abandoned and
why** (the single most valuable thing to record — it saves the next agent hours), the key
decisions and their rationale, and any preferences the user stated this session.

## 2. Write the handoff

If `$ARGUMENTS` is `quick`, write only the essentials block (Goal / Done / Next /
Watch-out / Session). Otherwise use the full structure — omit empty sections **except
Failed Approaches**:

```markdown
# Handoff: <short title>

**Status**: In Progress | Blocked | Ready for Review
**Branch**: <git branch>
**Session**: cc/<id>   ← omit this line if $CLAUDE_CODE_SESSION_ID was empty

> Need context this handoff doesn't hold? The full prior session is at the Session id.
> Read it with aii: `aii show cc/<id>` (run `aii index --source cc` first if not found).
> Don't guess at lost context — pull it.

## Goal
<1–2 sentences: what the user actually wants>

## Done
- [x] <specific, verifiable item>

## Not Yet Done
- [ ] <specific next action, written as a directive the next agent runs without asking>

## Failed Approaches (never omit if anything was abandoned; say "None" if truly nothing)
- <what was tried> → <why it failed, verbatim error if any> → <why the current path is better>

## Key Decisions
| Decision | Why |
|---|---|

## Current State
- **Working**: <what functions right now>
- **Broken**: <what doesn't, with error text>
- **Uncommitted**: <summary of staged/unstaged changes>

## Background Tasks (omit only if the inventory found none)
<paste the inventory block from step 1, verbatim including commands, and turn each
`restart: **decide**` into `restart: **yes**` (say what it watches and what to do when it
fires) or `restart: **no**` (say why it's finished with). Nothing here survives into the
new process — a swap kills them, and even a plain /compact stops delivering their events.>

## Files to Know
| File | Why it matters |
|---|---|

## Resume Instructions
1. <exact command or file to edit> → Expected: <outcome> · If it fails: <what to check>

## Warnings
<gotchas, things that look wrong but are intentional, traps to avoid>
```

Rules: show code/signatures, don't describe them. Every verification step needs an expected
outcome ("verify it works" is useless). Write **Not Yet Done** / **Resume Instructions** as
standing orders the next agent executes immediately — and if a step must NOT be done
autonomously (needs sign-off, a deploy gate, a destructive action), say so right there.

## 3. Save it

Save to `.claude/tmp/HANDOFF.md` under the **project root** — gitignored, so it never enters
version control. Never the root itself, a subdir, or a worktree you happen to have cd'd into.
If `$ARGUMENTS` is a path, use that instead.

```bash
ROOT="${CLAUDE_PROJECT_DIR:-}"; [ -z "$ROOT" ] && ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; if [ -z "$ROOT" ]; then d="$PWD"; while [ "$d" != "/" ] && [ ! -d "$d/.claude" ]; do d=$(dirname "$d"); done; ROOT="$d"; fi; [ "$ROOT" = "/" ] && ROOT="$PWD"; mkdir -p "$ROOT/.claude/tmp"; echo "$ROOT/.claude/tmp/HANDOFF.md"
```

The first line of the file must be `# Handoff: <title>` so `resume` can tell it
apart from persistent docs that merely happen to be named `HANDOFF.md`.

## Always end with the absolute path

After saving, the **last line of your final message MUST be the handoff's absolute path, on
its own line, with nothing after it** (e.g. `/Users/you/project/.claude/tmp/HANDOFF.md`) — a
full absolute path, never relative. Keep it last even if you summarize above it, so a
resuming agent (or `compact`) can point straight at it.
