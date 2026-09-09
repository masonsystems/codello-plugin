---
description: Pick up the conversation that ran in this Codello session before you
argument-hint: "[agent-session-id]"
---

Find the conversation that ran in **this** Codello session before you, read its opening ask and its last turns, and carry on from there.

Reach for this after a `/clear` — you cleared a session whose context had grown too large (or whose cache had expired) and you want the fresh agent to keep going on the same work. `/codello:fresh` also seeds a replacement with this command and the id already filled in.

This is deliberately **not** `claude --resume`. Resuming reloads the whole conversation, which is the thing you were escaping. This reads the two parts that carry the work — what it was asked to do and where it got to — and leaves the rest on disk.

## 1. Find the conversation — ONE Bash call

```bash
codello history --json
```

Run it with `dangerouslyDisableSandbox: true` — the CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach.

You get `conversations`, most recent first, each with `agentSessionId`, `agent`, `openedWith`, `lastSaid`, `lastInteractedAt` and `transcriptPath`. The conversation you are running in is excluded, so everything listed is a candidate.

- **`$ARGUMENTS` is set** → that id is the answer; find its row for the transcript path. This is the form `fresh` uses, and the id it passes is authoritative.
- **One conversation** → that is the one. Don't ask.
- **Several** → take the most recent unless another row's `openedWith` obviously matches what the user just said. Say which you picked in one line, and name the runner-up so they can redirect you.
- **None** → say so plainly and ask what they want to work on. Do not go hunting through `~/.claude/projects` for a conversation in the same directory: a conversation in this directory is not the same claim as a conversation in this session, and guessing wrong wastes a whole context on someone else's work.

If it prints `Not inside a Codello session`, this command has nothing to work with — tell the user it only works inside a Codello-managed session.

## 2. Read the bottom — ONE Bash call

`openedWith` from step 1 is the top: the first thing the user asked that conversation to do. For the bottom, read the last turns:

```bash
codello tail "$CODELLO_SESSION" --agent <agent-session-id> -n 8 --max-lines 40
# Monitors and background tasks that conversation started and never saw finish.
INV="${CLAUDE_PLUGIN_ROOT:-}/scripts/background-inventory.sh"
[ -f "$INV" ] || INV=$(find "$HOME/.claude/plugins" -maxdepth 7 -name background-inventory.sh -path "*codello*" 2>/dev/null | sort -V | tail -1)
[ -n "$INV" ] && [ -f "$INV" ] && bash "$INV" <agent-session-id>
```

Also `dangerouslyDisableSandbox: true`.

The inventory is the one thing the transcript won't tell you at a glance: what that
conversation left *running*. How much survived depends on how you got here — a
`/codello:fresh` swap killed the whole process tree, so every task listed is dead, while a
plain `/clear` left the processes alive but pointed their notifications at a conversation
that no longer exists, so you will never hear from them either. Treat both the same way:
re-arm what the work still needs, and say in your summary what you re-armed. Anything
watching a build, a deploy, or a CI run has been unwatched since the boundary.

That is normally enough to resume. Only if it isn't — the last turns are mid-thought, or they reference a decision you can't reconstruct — read further back from `transcriptPath` with a bounded read (`tail -c 400000 <path>`). Never read the whole file: these transcripts run to hundreds of megabytes, and re-inflating the context is the exact cost this command exists to avoid.

## 3. Get to work

Reconstruct the state from what you read, then **start**. Say what you're picking up in about three lines and begin:

```
Picking up <agent-session-id-prefix> · <agent> · last active <time>
Goal: <1 sentence, from the opening ask>
Where it stopped: <1 sentence, from the last turns> — continuing with <first action>.
```

Then run the first action in the same turn. The user cleared the session to keep working, not to be asked whether they'd like to.

Check the repo before you trust the transcript on anything physical. Unlike a `/codello:fresh` swap, an arbitrary amount of time may have passed since that conversation stopped — `git status`, `git log --oneline -5` and the branch name are one cheap call and they settle what actually got committed. Where the transcript and the repo disagree, the repo is right.

Pause for the user only when the outstanding work is genuinely ambiguous after reading both ends, when a blocker needs a decision or credentials only they can give, or when the conversation had finished and there is nothing left to continue — then say what you loaded and ask what's next.
