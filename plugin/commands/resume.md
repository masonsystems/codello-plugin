---
description: Resume work from a handoff written by `handoff` (also what an in-place context reset re-seeds into)
argument-hint: "[path]"
---

Pick up work from a handoff. This is also the command a `compact` swap re-seeds the
fresh `claude` process with, so keep it robust.

## 1. Load the handoff

Resolve in priority order:

1. **Explicit path** — if `$ARGUMENTS` is set, read that path. Trusted; load it directly.
2. **Default** — resolve the project root (`$CLAUDE_PROJECT_DIR`, else `git rev-parse
   --show-toplevel`, else walk up from the cwd to the nearest `.claude/`) and read
   `.claude/tmp/HANDOFF.md` there. A real handoff's first line is `# Handoff:`.
3. Nothing found → ask the user for the path. Don't hunt for stray `HANDOFF.md` files — one
   at the repo root or cwd is a persistent doc, not a session handoff; load it only if the
   user points you at it explicitly.

Handoffs are **not** auto-loaded — a new session picks one up only when you run
`resume` (optionally with a path). Read the whole document.

## 2. Delete the handoff if it's the one-shot baton — before any work

A handoff at `.claude/tmp/HANDOFF.md` is a **one-shot baton**: `handoff` writes there,
and a `compact` swap re-seeds this session by pointing `resume` at that exact
path. So the instant you've read it, delete it — right now, before summarizing, before touching
code — **whether you loaded it by default (no arg) or via an explicit `$ARGUMENTS` path**. Its
content is already in your context; a lingering `.claude/tmp/HANDOFF.md` is the #1 cause of
"which handoff is actually resuming?" confusion and gets silently re-loaded (and deleted) by the
next no-arg resume. Deleting it is safe: the compact swap fires exactly once, so there is no
re-fire that still needs the file.

The discriminator is the file's location, **not** how the path was passed. Delete the exact file
you loaded only when its path is that ephemeral baton (ends in `.claude/tmp/HANDOFF.md`):

```bash
HP="$ARGUMENTS"; if [ -z "$HP" ]; then ROOT="${CLAUDE_PROJECT_DIR:-}"; [ -z "$ROOT" ] && ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; if [ -z "$ROOT" ]; then d="$PWD"; while [ "$d" != "/" ] && [ ! -d "$d/.claude" ]; do d=$(dirname "$d"); done; ROOT="$d"; fi; [ "$ROOT" = "/" ] && ROOT="$PWD"; HP="$ROOT/.claude/tmp/HANDOFF.md"; fi; case "$HP" in .claude/tmp/HANDOFF.md|*/.claude/tmp/HANDOFF.md) rm -f "$HP" && echo "deleted one-shot handoff: $HP" ;; *) echo "kept persistent doc (not a .claude/tmp baton): $HP" ;; esac
```

Exception: an explicit `$ARGUMENTS` path that points **elsewhere** — anything not ending in
`.claude/tmp/HANDOFF.md` (a doc at the repo root, under `docs/`, a saved plan) — is a persistent
doc the user pointed at deliberately; the `case` above leaves it untouched.

## 3. Re-arm the background tasks

Do this before the work and before your summary line — the summary reports a count you have
to have earned.

If the handoff has a **Background Tasks** section, act on it first: the swap killed every one
of those processes, and nothing else in the session will remind you they existed. Re-arm each
`restart: **yes**` entry from the command recorded there, using the same tool it came from —
a `monitor` entry goes back through `Monitor`, a `bash` entry through Bash with
`run_in_background: true`.

Re-arm before the work because the work often depends on one of them (a build you're waiting
on, a deploy you're watching), and a monitor armed after the event it was watching has already
fired never reports. Skip the `restart: **no**` entries silently. If an entry says **yes** but
its command no longer makes sense here — it watched a path that's gone, or a PID from the dead
process — don't re-arm something that can only fail; say so in your summary instead.

No **Background Tasks** section, or nothing marked **yes**? Nothing to do here — drop the
`Re-armed:` line from the summary below rather than printing a zero.

## 4. Get to work

A compact swap re-execs a fresh process under the *same* PTY and checkout with ~zero elapsed
time, so there's nothing to reconcile against the repo — go straight to the work. Give a
one-line summary and **start on the outstanding work immediately** — **Not Yet Done** /
**Resume Instructions** are standing orders the user already gave. Don't end on "Ready to
continue?" and wait.

```
Resuming from handoff: <title>
Goal: <1 sentence> · Status: <X of Y done>
Re-armed: <n> background task(s), dropped <n> · starting with <first item>.
```

The user armed those watches for a reason and cannot see that they died, so say what you
re-armed and what you dropped — that line is the only place they learn it.

Pause for the user only when: a blocker needs a
decision/credentials/access only they can give, the outstanding work is genuinely ambiguous
**and** the source transcript doesn't resolve it (`aii show cc/<id>`), or there's no
actionable work left (pure context) — then say it's loaded and ask what they want.

Heed **Failed Approaches** (don't repeat them), **Warnings**, and **Key Decisions**.
