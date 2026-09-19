---
name: session-status
description: "Tell Codello this session is waiting on the user when it cannot work that out for itself — `codello session-status set waiting -m \"<what they have to do>\"`, and `codello session-status clear` when the wait ends. Codello infers a session's state from hooks, and that inference reads a background task, a Monitor, or a hosted server as the agent being busy, so a turn that ends needing the user behind one of those shows no dot and sends no push. Triggers: you are ending a turn that needs the user and something you started is still running — a background Bash task, a watcher you re-armed, a Monitor, a dev server or a published page you are hosting."
---

# Say when this session is waiting on the user

Codello works out what a session is doing from Claude Code's hooks. That inference is right nearly always, and it has one case it cannot get right: a turn that ends needing the user while something the agent started is still running. That looks exactly like a turn the agent is about to resume on its own, so Codello stays quiet. The session sits with no dot and sends no push, and the user has no way to know they are the thing it is waiting for.

Declare it instead.

```bash
codello session-status set waiting -m "Answer the three questions on the follow-up board."
```

The session shows the needs-you dot with that line on its row, and the user gets one push carrying the same line. Then write your reply as normal — the declaration lands when the turn ends.

## When to run it

Run it whenever both halves are true: this turn is ending and the user has to do something, **and** something you started is still running.

- You published a follow-up board, a form, or a page and are waiting for answers.
- You armed a background watcher or a polling task that resumes you when the user responds.
- A Monitor is up, waiting on a condition only the user can produce.
- You are hosting a dev server, a preview, or a tunnel the user has to look at.
- A long background build or test run is going, and you need a decision before you can use its result.

You do not need it for an ordinary turn that ends waiting on the user. Codello already raises the dot for that, and it already raises it for a permission prompt and for `AskUserQuestion`. This is only for the case where something of yours is still running and would otherwise hide the fact that you stopped.

## When the wait ends

```bash
codello session-status clear
```

Run it as soon as the thing you were waiting for arrives, if the user did not just tell you themselves. The session goes back to whatever Codello infers.

You do not have to clear it when the user replies: their reply clears it. Nor when you finish and run `codello done`, which replaces it with the outcome.

**A declaration survives your own work, by design.** If the user has not answered and your hourly watcher fires and wakes you up, the dot stays up through that whole turn and the user is not buzzed again. Re-run `session-status set` only to change the message.

## What clears it

| | |
|---|---|
| The user types in the session | Clears it |
| The user sends a message from the phone or the web | Clears it |
| `codello session-status clear` | Clears it |
| `codello done` | Replaces it with the outcome |
| Your background task firing and resuming you | **Does not** clear it |
| Anything else you do in the session | **Does not** clear it |

## Write the message for a lock screen

`-m` is one line, read on a phone, away from the session.

- **Say what the user has to do**, not what you did. "Answer the three questions on the follow-up board" beats "Waiting for input."
- **Name the thing**, so the line identifies which session this is out of several.
- It is optional, and without it the push says only that the agent is waiting, which makes the user open the session to find out why.

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

Expect:

```
Status set to waiting. When this turn ends the session shows as waiting on you and you are notified.
It stays that way until you reply, or the agent runs `codetogo session-status clear` or `codetogo done`.
```

Nothing is armed until that line prints. If the command prints anything else, end the turn normally and say plainly what you are waiting for:

- `Not in a Codello session`: Codello did not spawn this PTY, so there is no session row to mark.
- `Server not running`: the Codello server is down.
- `Unknown status`: `waiting` is the only state there is.

## Related

`/codello:done` reports what the session's task ended as, and means nothing is left for the user. This skill is its opposite: the turn ended and the user is exactly what is left. Run `session-status set waiting` when you are handing something back, and `done` only when you are handing nothing back.
