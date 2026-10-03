---
description: Reset THIS live Codello session's context in place — like /compact, but a real process reset reseeded from a handoff
argument-hint: "[handoff-path]"
---

Codello's counterpart to `/compact`. Where `/compact` summarizes the context *in place*
(same polluted process, now with a summary on top), this does a **hard reset**: it replaces
the `claude` process running under **this** Codello session with a fresh one — same terminal
pane, same session id, same viewers, same phone entry, same scrollback — reseeded from a
handoff you write now. The "summary" is a curated handoff, and the reset is a **real new
process** (context truly reset to near-zero). Reach for it when the context is *polluted*,
not merely long.

The swap fires at the next idle boundary — i.e. **when this turn ends** — via Codello's
Stop hook: this turn writes the handoff and arms the compact; the moment you finish, the old
`claude` is killed and `claude /codello:resume <path>` takes its place under the same PTY.
The client sees no reconnect, only new output.

## HARD RULE — this command is a stop order

The whole point of this command is to stop spending tokens in this process **immediately**.
From the moment it's invoked, your only remaining job is: write the handoff, arm the compact,
end the turn. That is exactly **three tool calls** — the Bash call in step 1, the Write of the
handoff in step 2, the Bash call in step 3 — and **nothing else**.

Do **not** use any other tool or do any other work: don't finish the in-flight task, don't
run tests, don't gather state (`git status`, `git diff`, log searches, file reads), don't
tidy up, don't investigate. Anything you were doing — or wanted to do — becomes a **Not Yet
Done** item in the handoff for the next agent; the fresh process does it, not you. Every
extra tool call here adds a turn and spends the very tokens this command exists to save.

## 1. Precondition + handoff path + background inventory — ONE Bash call

```bash
if [ -z "$CODELLO_SESSION" ]; then echo "NOT a Codello-owned session"; else ROOT="${CLAUDE_PROJECT_DIR:-}"; [ -z "$ROOT" ] && ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; if [ -z "$ROOT" ]; then d="$PWD"; while [ "$d" != "/" ] && [ ! -d "$d/.claude" ]; do d=$(dirname "$d"); done; ROOT="$d"; fi; [ "$ROOT" = "/" ] && ROOT="$PWD"; mkdir -p "$ROOT/.claude/tmp"; echo "owned: $CODELLO_SESSION"; echo "transcript: cc/$CLAUDE_CODE_SESSION_ID"; echo "handoff: $ROOT/.claude/tmp/HANDOFF.md"; echo; INV="${CLAUDE_PLUGIN_ROOT:-}/scripts/background-inventory.sh"; [ -f "$INV" ] || INV=$(find "$HOME/.claude/plugins" -maxdepth 7 -name background-inventory.sh -path "*codello*" 2>/dev/null | sort -V | tail -1); if [ -n "$INV" ] && [ -f "$INV" ]; then bash "$INV" | tee "$ROOT/.claude/tmp/background-inventory.md"; echo; echo "inventory: $ROOT/.claude/tmp/background-inventory.md"; else echo "_Background inventory script not found — list any monitors/background tasks you remember starting._"; fi; fi
```

This only works when Codello spawned the PTY — a `codello claude` session, the web "new
session" button, or a scheduled session. A bare `claude` that Codello only sees via hooks
is **not** swappable. If it prints `NOT a Codello-owned session`, stop and tell the user
this command only works inside a Codello-managed session — there's nothing to reset.

The same call prints the **background inventory**: every `Monitor` and background `Bash`
task this session started that never reported finishing. The swap kills the outgoing
`claude` with `killProcessTree`, so every one of them dies mid-flight — a monitor watching
a deploy, a poll loop waiting on CI, a long build. None of it survives, and the fresh
process has no way to discover any of it existed. That output is the only record; carry it
into the handoff in step 2.

## 2. Write the handoff — from context only

Write a complete `# Handoff: <title>` document (the format `/codello:handoff` defines) to
the `handoff:` path from step 1, built **entirely from what's already in your context**. Run
nothing to gather state — the next agent can run `git status` itself for one cheap call; you
re-deriving it now defeats the purpose. If you don't know something (exact diff state,
whether tests pass), *say so in the handoff* rather than checking. Include the `transcript:`
id from step 1 so the next agent can consult the source conversation.

Everything unfinished — including whatever this command interrupted — goes under **Not Yet
Done** / **Resume Instructions** as standing orders for the next agent.

**Carry the background inventory across.** If step 1 listed live tasks, copy that
`## Background Tasks` block into the handoff verbatim — commands included, since the fresh
process re-arms from them — and replace each `restart: **decide**` with your actual call:

- `restart: **yes**` — the work depends on it. Say what it's watching and what to do when it
  fires, so re-arming isn't guesswork.
- `restart: **no**` — it was scaffolding, already answered its question, or watches something
  that's finished. Give the one-line reason; "no" without a reason reads as an oversight and
  the next agent re-arms it anyway.

You cannot check whether a task is still doing anything useful — that would cost tool calls
this command exists to save. Judge from what you already know it was for. When genuinely
unsure, mark it **yes**: a redundant monitor costs one tool call to stop, a dropped one
costs a silent failure nobody is watching for.

If `$ARGUMENTS` is a path, the user already wrote/reviewed the handoff — skip this step and
use that path instead. Their handoff predates the inventory, so if step 1 listed live tasks,
append the file step 1 saved, from step 3's Bash call, before the `codello compact` line:

```bash
cat "<root>/.claude/tmp/background-inventory.md" >> "<their-handoff-path>"
```

Append the **file**, never a heredoc carrying the block inline. A recorded task command can
itself contain `<<'EOF'`, which closes your outer heredoc early and feeds the rest of the
inventory to the shell as commands. `cat` of a file on disk has no delimiter to collide with.

## 3. Arm the compact, then end the turn

Arm the in-place swap for THIS session, pointing at the handoff's **absolute** path — the
explicit path guarantees the fresh `claude` loads *this* handoff regardless of the dir it
respawns in (a no-arg resume resolves the default path from cwd, which lands in the wrong tree
for a worktree session — COD-811). The resumed session deletes the baton after reading it:

```bash
codello compact "<absolute-handoff-path>"
```

When the Bash sandbox is on, run this with `dangerouslyDisableSandbox: true` — the CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach. Nothing is armed until the line below prints, so don't end the turn on a failure here.

Expect `Session compact armed.` Then **end your turn immediately** — one line to the user
("Handoff written, compact armed — resetting now."), no work summary, no follow-ups. The
swap fires on the next Stop hook, so an in-flight turn is never killed. If it instead prints
`Not in a Codello session` or `Failed to arm session compact: …`, the step-1 precondition
wasn't actually met (or the server isn't running) — report exactly what it said and stop.
