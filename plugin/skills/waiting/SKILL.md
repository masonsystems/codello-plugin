---
name: waiting
description: "Tell Codello that this session is waiting on the user — `codello session-status set waiting -m \"<what they have to do>\"`, and `codello session-status clear` when the wait ends. Run set at the end of any turn that leaves something only the user can do: a pull request is up and needs their review or merge, you asked a question or a decision is theirs, a permission or credential you cannot grant yourself, a blocker only they can clear. Codello infers state from hooks and reads a session with a Monitor, a background task, or a dev server still running as busy, so without the declaration the user is never told. Also /codello:waiting. Triggers: you are about to end a turn with a Blocker, a Decision needed, a question, a PR URL for review, or \"waiting on you\" in your reply."
---

# Declare that this session is waiting on the user

Codello shows the user a needs-you dot when a turn ends on a question or a permission prompt. It cannot see a wait that you describe in prose, and if anything you started is still running (a `Monitor`, a background `Bash`, a subagent, a dev server) the session reads as busy however plainly your reply says otherwise, so the user is never told. The declaration replaces the inference.

```bash
codello session-status set waiting -m "PR ready for review: https://github.com/org/repo/pull/123"
```

The command arms the declaration and returns at once. It fires when the current turn ends, exactly as `codello done` does: the session row shows the needs-you dot with your `-m` line, and one push goes out carrying the same line. Nothing you do afterward moves it, not a watcher firing, not the turn that watcher starts.

## Only the session's lead agent runs this

If another agent spawned you — as a subagent, a Task delegate, or a teammate — this command is not yours to run. You share the lead agent's session, so it reports the user's whole session rather than your piece of the work, and it does that while the lead is still working.

Report your result to the agent that spawned you and let it decide what the session ended as. The host refuses a delegate's report with `You are a delegate agent (a subagent or teammate), not this session's lead.` If you see that line, hand your result back instead.

## When to set it

Run it silently in the turn that leaves something only the user can do, before you write the final reply. Never mention the command or the status in the reply: "I've marked this session as waiting on your answer" tells the user nothing they need. Set it when:

- A pull request is open and needs their review, approval, or merge.
- You asked a question, or a decision is theirs to make.
- A permission you cannot grant yourself: a denied command, a credential, an interactive login, an MFA prompt.
- A blocker only they can clear: an environment you cannot reach, an account you do not have, a change on a system outside your access.
- You are handing back a **Blocker** or **Decision needed** item.

One declaration per wait. A second `set` replaces the line on the row and sends another push, so declare once and declare again only when what the user has to do has changed, or when a declaration was dropped.

The declaration fires at the end of the turn. If the user types before the turn ends, the armed declaration is dropped: no dot, no push, because their message may already be the answer. If that message did not answer you, declare again in the next turn.

## When to clear it

Run `codello session-status clear` when the wait ends without the user typing in the session:

- The thing you were waiting for arrived another way: the PR got merged, CI finished, the blocker went away, a background task delivered what you needed.
- You are about to keep working on your own after all.

You do not need to clear it when the user replies. Their message, typed in the terminal or sent from the phone, retires the declaration on its own, and so do `codello done` and the user dismissing the session from the dashboard. If the next user message arrives and you still need something, declare again in that turn.

## Never in the same turn as done

`codello done` retires a declared wait before it records its own outcome, so `set waiting` followed by `done` in one turn leaves the session marked done with the wait gone. The two say opposite things: done means nothing is left for the user, waiting means something is. Pick one. The `done` skill's rule applies: an open PR, a question, a decision, or a follow-up means waiting, not done.

## Write the message for a lock screen

`-m` is the push the user reads, and the only one: your reply does not reach their lock screen. It is one line, read on a phone, out of context, possibly hours later, so put the substance of what you need from them in it. Say what the user has to do and name the thing: "Review and merge codello-plugin PR #12, the waiting skill" or "Approve the gh pr create permission" beats "Waiting on you".

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

Expect, for `set`:

```
Status set to waiting. When this turn ends the session shows as waiting on you and you are notified.
It stays that way until you reply, or the agent runs `codetogo session-status clear` or `codetogo done`.
```

And for `clear`, one of:

```
Declared status cleared. This session goes back to the state Codello infers.
```

```
No declared status to clear.
```

Nothing is armed until the `set` line prints. If the command prints anything else, say so in your reply and end the turn normally:

- `Not in a Codello session`: Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session can declare a status.
- `Server not running`: the Codello server is down, so there is nothing to record the declaration.
- `A cursor session cannot declare a status`: the declaration fires on a Stop hook, and Cursor has none. Claude Code and Codex sessions can declare; a Cursor session states the wait in its reply instead.

## Options

| Command | Purpose |
|------|---------|
| `codello session-status set waiting -m <text>` | Declare the wait; `-m` is the one line shown on the row and in the push |
| `codello session-status clear` | Withdraw the declaration; the session goes back to what Codello infers |

## Related

`/codello:done` reports an outcome when nothing is left for the user. `/codello:quit` ends the session outright after a task the user asked you to finish and quit. `codello snooze` is the opposite of this skill: it hides a session that is waiting on something Codello cannot see, so the user is not surfaced for a wait that is not theirs.
