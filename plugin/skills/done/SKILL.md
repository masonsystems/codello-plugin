---
name: done
description: "Run `codello done`, or `codello done --failed`, at the end of a turn when the task is finished and nothing is left for the user: no PR to review, no question, no decision. Marks the session done (green check) or failed (red ✕). Also /codello:done."
---

# Report what this session ended as

`codello done` puts the outcome on the session's row, so the user learns what happened without opening it.

```bash
codello done -m "Fixed the parser crash and merged the pull request."
```

```bash
codello done --failed -m "The staging database is unreachable, so the migration never ran."
```

The command arms the outcome and returns at once. It lands when the current turn ends, so run it and then write your reply as normal — that reply is what the user reads when they open the session.

## Only the session's lead agent runs this

If another agent spawned you — as a subagent, a Task delegate, or a teammate — this command is not yours to run. You share the lead agent's session, so it reports the user's whole session rather than your piece of the work, and it does that while the lead is still working.

Report your result to the agent that spawned you and let it decide what the session ended as. The host refuses a delegate's report with `You are a delegate agent (a subagent or teammate), not this session's lead.` If you see that line, hand your result back instead.

## Done means nothing is left for the user

This is the whole rule, and it is stricter than "I finished my part."

Do **not** run `codello done` when any of these is true:

- A pull request is open and waiting for the user to review, approve, or merge it.
- There is a follow-up for them: a command to run, a credential to add, a setting to change, a deploy to approve.
- You asked a question, or a decision is theirs to make.
- You want them to check, confirm, or look at something.
- Part of the work is unfinished, deferred, or blocked.

In each of those cases, end the turn normally and say plainly what is pending. The ordinary "needs you" indicator is the right signal, and it is the one the user acts on. Marking such a session done is worse than saying nothing: it tells them there is nothing to come back for, and the session removes itself a day later.

## In a task-mode session, done is how every task ends

A task-mode session was started with `codello spawn --task` or the app's Task mode checkbox, and its system prompt says so. There the rule above is replaced: nobody reads your replies, so the work is never handed back in prose. When the work is finished, report it with `codello done`, even when it leaves something for the user, and put that something in `--next`:

```bash
codello done -m "Fixed the race in the upload test" --tests "npm test: all passed" --next "Review and merge the PR" --link "https://github.com/org/repo/pull/12"
```

The report shows as a card on the task's session, sends the user a push, and is typed into the chat session that started the task, if there is one. A turn that ends with no `codello done` and no `codello ask` waiting is sent back to you to continue. Ask questions with `codello ask` (see `codello ask --help`), never in your reply.

## Failed means you could not do it

Use `--failed` when the task cannot be completed as asked — a dependency that does not exist, an environment you cannot reach, an approach that turned out to be impossible. A failed session sends the user a push, because they have been waiting on work that is not coming.

Do not use `--failed` for work you merely have not finished yet, or for a task that is blocked on the user. Blocked is not failed: leave the session waiting and say what you need, and declare the wait with `codello session-status set waiting -m "<what you need>"` (the `waiting` skill, `/codello:waiting`) so the session row shows it even while a background task of yours keeps the session looking busy. Never run `done` and `set waiting` in the same turn: `done` retires the declaration.

## What each outcome does

| Command | Indicator | Push | Session |
|---|---|---|---|
| `codello done` | Green check | None — the check is there when they next look | Closes itself after 24 hours, unless the user opens it or types in it |
| `codello done --failed` | Red ✕ | `Failed · <session>`, with your summary as the body | Stays open |
| `codello done` in a task | Green check and the report card | `Done · <session>`, with your summary as the body | As for `codello done`; the report goes to the session that started the task |
| `codello done --failed` in a task | Red ✕ and the report card | As for `--failed` | Stays open; the report goes to the session that started the task |

Either outcome clears the moment the user types in the session, like any other indicator. A session blocked on a permission prompt or a question still reads as blocked — that outranks both.

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

Expect one of:

```
Task reported as done. When this turn ends the session is marked done; it closes itself in 24 hours.
```

```
Task reported as failed. When this turn ends the session is marked failed and you are notified.
```

Nothing is armed until that line prints. If the command prints anything else, report exactly what it said and end the turn normally:

- `Not in a Codello session`: Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session can report an outcome.
- `Server not running`: the Codello server is down, so there is nothing to record the outcome.

## Write the summary for a lock screen

`-m` is one line, read on a phone, out of context, possibly a day later.

- **Say what happened, not what you did all session.** "Merged the retry fix" beats "Investigated, wrote tests, and merged."
- **Name the thing.** "Fixed the parser crash" tells the user which session this is; "All done" does not.
- **For a failure, say what stopped you.** That is the line they act on.
- It is optional, but a check mark with no words makes the user open the session to find out what finished.

## Options

| Flag | Purpose |
|------|---------|
| `-m, --message <summary>` | One line on what happened; the push body when the task failed |
| `--failed` | The task could not be completed |
| `--tests <results>` | What you ran to verify the work and what it printed, in one line |
| `--next <action>` | The one action you recommend next, usually the user's |
| `--link <url>` | The PR, diff, or page the work produced; must be an `http` or `https` URL |
| `--summary-file <path>` | A JSON file with `summary`, `tests`, `next`, and `link`; a flag wins over the same field in the file |

`--tests`, `--next`, `--link`, and `--summary-file` need a CLI with task mode; check `codello done --help`. A bad link or an unreadable summary file is refused before anything is armed.

## Related

`/codello:quit` ends the session outright at the same boundary, leaving no record of an outcome. Use `/codello:done` when the user should still be able to open the session and read what happened; use `/codello:quit` when the user told you to go away and there is nothing worth coming back to. `/codello:waiting` is for the turns this skill tells you not to run `done` on: it declares that the session needs the user, and what for.
