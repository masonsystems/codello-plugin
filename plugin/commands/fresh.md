---
description: Replace this session's agent with a fresh one told to pick up where this conversation left off
---

Swap the `claude` running under **this** Codello session for a fresh process, and hand the replacement nothing but the id of the conversation it replaced. The replacement runs `/codello:continue <id>`, reads this transcript's opening ask and last turns, and carries on.

Reach for it when the context is merely **too big** — a long session whose cache has expired, where the next turn costs a fortune and most of what's in context is no longer load-bearing. Same terminal pane, same session id, same viewers, same phone entry, same scrollback; the client sees no reconnect, only new output.

Sibling of `/codello:compact`, and the difference is what the dying agent has to do:

| | writes | reach for it when |
|---|---|---|
| `/codello:compact` | a curated handoff, in this context, at this context's prices | the context is **polluted** — dead ends and wrong turns the next agent must not inherit |
| `/codello:fresh` | nothing at all | the context is merely **expensive** — the work is fine, the transcript is just enormous |

A handoff is better context than a transcript. It is also one more turn in the most expensive session you have, which is why this command exists: when that turn is the thing you're trying to avoid, skip it and let the replacement read the transcript at fresh-context prices.

The swap kills the whole process tree, so any `Monitor` or background `Bash` task this session started dies with it. You do **not** inventory them here — that would cost the turn this command exists to skip. `/codello:continue` reads them out of this transcript on the other side and re-arms what still matters.

## HARD RULE — this command is a stop order

From the moment it is invoked, your only remaining job is to arm the swap and end the turn. That is exactly **one tool call** — the Bash call below — and nothing else.

Do not finish the in-flight task, run tests, gather state (`git status`, `git diff`, log searches, file reads), write a summary, or tidy up. There is no handoff to write here; that is the entire point. Anything you were doing is still in the transcript, and the replacement reads the transcript. Every extra tool call spends the very tokens this command exists to save.

## Arm it, then end the turn

```bash
codello fresh
```

Run it with `dangerouslyDisableSandbox: true` — the CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach.

Expect:

```
Session pickup armed. The next time this session goes idle, claude will be
replaced in place and told to pick up conversation <id>
```

Then **end your turn immediately** — one line to the user ("Pickup armed — swapping now."), no work summary, no follow-ups. The swap fires on the next Stop hook, so an in-flight turn is never killed.

Nothing is armed until that line prints, so don't end the turn on a failure. If it prints something else, report exactly what it said and stop:

- `Not in a Codello session` — Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session is swappable; a bare `claude` that Codello merely sees via hooks is not.
- `This session is not running Claude Code` — the replacement relaunches as `claude /codello:continue`, so only a Claude Code conversation can be swapped this way.
