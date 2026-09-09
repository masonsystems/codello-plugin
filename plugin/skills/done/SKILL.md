---
name: done
description: "Report the outcome of the task this CodeToGo session was opened for — `codetogo done`, or `codetogo done --failed`. Run it at the end of a turn, and ONLY when nothing is left for the user in this session: no pull request awaiting their review, no follow-up they have to run, no question, no decision, nothing to check. The session's status indicator becomes a green check (done) or a red ✕ (failed), and a done session closes itself 24 hours later. Also `/codetogo:done`. Triggers: you finished everything you were asked to do and have nothing to hand back, or you ran out of ways to do it and have to report that you could not."
---

# Report what this session ended as

`codetogo done` puts the outcome on the session's row, so the user learns what happened without opening it.

```bash
codetogo done -m "Fixed the parser crash and merged the pull request."
```

```bash
codetogo done --failed -m "The staging database is unreachable, so the migration never ran."
```

The command arms the outcome and returns at once. It lands when the current turn ends, so run it and then write your reply as normal — that reply is what the user reads when they open the session.

## Done means nothing is left for the user

This is the whole rule, and it is stricter than "I finished my part."

Do **not** run `codetogo done` when any of these is true:

- A pull request is open and waiting for the user to review, approve, or merge it.
- There is a follow-up for them: a command to run, a credential to add, a setting to change, a deploy to approve.
- You asked a question, or a decision is theirs to make.
- You want them to check, confirm, or look at something.
- Part of the work is unfinished, deferred, or blocked.

In each of those cases, end the turn normally and say plainly what is pending. The ordinary "needs you" indicator is the right signal, and it is the one the user acts on. Marking such a session done is worse than saying nothing: it tells them there is nothing to come back for, and the session removes itself a day later.

## Failed means you could not do it

Use `--failed` when the task cannot be completed as asked — a dependency that does not exist, an environment you cannot reach, an approach that turned out to be impossible. A failed session sends the user a push, because they have been waiting on work that is not coming.

Do not use `--failed` for work you merely have not finished yet, or for a task that is blocked on the user. Blocked is not failed: leave the session waiting and say what you need.

## What each outcome does

| Command | Indicator | Push | Session |
|---|---|---|---|
| `codetogo done` | Green check | None — the check is there when they next look | Closes itself after 24 hours, unless the user opens it or types in it |
| `codetogo done --failed` | Red ✕ | `Failed · <session>`, with your summary as the body | Stays open |

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

- `Not in a CodeToGo session`: CodeToGo did not spawn this PTY. Only a `codetogo claude` session, the web "new session" button, or a scheduled session can report an outcome.
- `Server not running`: the CodeToGo server is down, so there is nothing to record the outcome.

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

## Related

`/codetogo:quit` ends the session outright at the same boundary, leaving no record of an outcome. Use `done` when the user should still be able to open the session and read what happened; use `quit` when the user told you to go away and there is nothing worth coming back to.
