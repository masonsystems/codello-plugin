---
name: emergency
description: "Raise an emergency alert to the user now — `codello emergency -m \"<what broke>\"`. It sends a Time Sensitive push to their phone and desktop at once and turns the session red. Use it ONLY for harm that is happening right now and that you cannot fix or contain yourself: a production outage, data loss or corruption, leaked credentials, a destructive action that went wrong, runaway cost, whether you caused it or found it. Any agent in the session may run it, including a subagent or teammate. Never for a blocker, a question, a permission, a failing test, or finished work: those use codello:waiting and codello:done. Also /codello:emergency."
---

# Raise an emergency alert

`codello emergency` gets the user's attention now, wherever they are. It is the one Codello command that does not wait for the turn to end.

```bash
codello emergency -m "Prod API returning 500s since my deploy of abc123; rolled back, still failing"
```

The command sends a Time Sensitive push to the user's phone and desktop immediately, which breaks through Focus modes, and gives the session a red emergency status on every device. A snoozed session wakes up. Your turn keeps going.

The red status stays up while you keep working. Your own tool calls, a compact, and `codello session-status clear` do not take it down. It clears only when the user engages with the session: they open or select it, type in it, mark it read, snooze it, or press Esc in it.

## Only for harm that is happening now

Raise an emergency when both of these are true:

- **Something is causing real harm right now.** Production is down or degraded, data is being lost or corrupted, a credential or secret leaked, a destructive command did more than intended, or money is burning (a runaway job, an autoscaler, a paid API in a loop). It does not matter whether you caused it or found it.
- **You cannot fix or contain it yourself right now.** You lack the access, the fix needs a decision only the user can make, or what you tried has not stopped it.

Never raise one for:

- A blocker, a question, a decision, or a permission you need. Use `codello session-status set waiting` (the `waiting` skill, `/codello:waiting`).
- A failing test, a broken build, a flaky CI run, or a bug you found that is not hurting anyone yet. Report it in your reply.
- Finished or failed work. Use `codello done` or `codello done --failed` (the `done` skill, `/codello:done`).
- Something that was harmful but is already resolved. Tell the user in your reply; an alert after the fact interrupts them for nothing they can act on.

An emergency wakes the user up. If you are unsure whether it qualifies, ask yourself whether the user would want to be pulled out of a meeting or out of bed for it. If not, it is not an emergency.

## Contain, alert, keep working

1. **Contain what you safely can first.** Stop what you started: cancel the job, stop the process you launched, roll back your own deploy, revoke the key you exposed. Do only what is safe and within your access; never attempt a riskier fix to avoid raising the alert.
2. **Raise the emergency.** Do not wait for the end of the turn or until you have a full diagnosis.
3. **Keep working on mitigation.** The alert is not a hand-off. Keep investigating and containing, and write up what you found and what the user must do in your reply.

## Any agent in the session may run it

Unlike `done` and `session-status`, this command is not reserved for the session's lead agent. A subagent, a Task delegate, or a teammate that finds an emergency raises it directly, because routing the report through the lead can cost minutes the user does not have. After you raise it, report it to the agent that spawned you as well, so the lead knows the user was alerted.

## Raise it once

The host sends at most one push per session in any 5 minutes, counted from the last push that went out. A second `codello emergency` inside that window sends no push: it only replaces the message on the red session row. Run it again only when the situation changes, such as when the harm spreads or your mitigation fails, and put the rest of the detail in your reply. Never repeat it to escalate; a repeat inside the window cannot reach the user's phone.

## Write the message for a lock screen

`-m` is the push body, read on a lock screen by someone who does not know what you were doing. Keep it under about 150 characters so it fits on a lock screen; the host keeps at most 500. `-m` is required, and an empty message is refused.

- **Start with what is broken and its impact.** "Prod API returning 500s" or "Deleted 4,000 customer rows in the prod database", not "I ran a migration".
- **Then say what you did about it.** "rolled back, still failing" or "stopped the job, no backup found".
- **Name the thing.** A service, a database, a bucket, a commit, a key.
- **State facts plainly.** No hedging ("might", "possibly", "I think"), no apology, no preamble.

Examples:

```bash
codello emergency -m "AWS key AKIA...7Q pushed to public repo codello-demo; deleted the commit, key still active"
```

```bash
codello emergency -m "Nightly export job looping on prod, ~\$40/min in Bedrock calls; cannot stop it without admin access"
```

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

The alert went out when the command prints:

```
Emergency raised. The user was sent a Time Sensitive push, and the session shows a red emergency status until they open it.
Keep working to contain the damage; run this again only if the situation changes.
```

A repeat inside the 5-minute window prints this instead, with the wait until another push is allowed:

```
Emergency updated. The session still shows the emergency with your new message.
No push was sent: this session already sent one in the last 5 minutes. Another push is allowed in 3m 20s.
```

That is not a failure: the user already got a push for this session, and the row now shows your new message. Do not retry to get the push through.

Anything else means no push went out. Put the emergency at the top of your reply in plain words either way:

- `Not in a Codello session`: Codello did not spawn this PTY, so there is no session to alert from. Do not mention the command or its error.
- `Server not running. Start with: codello start` or `Failed to connect to server`: the Codello server is down or unreachable, so it cannot send the push. Say that the alert did not go out.
- `Failed to raise the emergency: <reason>`: the host refused it or is older than this command. Say that the alert did not go out.
- `An emergency needs a message: ...`: `-m` was missing or empty. Run it again with a message.
- `error: unknown command 'emergency'`: this `codello` CLI predates the command. Say that the alert did not go out.

## Options

| Flag | Purpose |
|------|---------|
| `-m, --message <text>` | What is broken, its impact, and what you did; the push body |

## Related

`/codello:waiting` declares that the session needs the user at the end of a turn; use it for everything that can wait for the user to next look. `/codello:done` reports the outcome of a finished or failed task.
