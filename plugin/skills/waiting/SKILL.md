---
name: waiting
description: "Run `codello session-status set waiting -m \"<what they can do>\"` at the end of a turn that leaves the user something with no card: a PR to review or merge, findings or a report they have to read. Run `codello session-status set blocked -m \"<what they must do>\"` when work cannot continue until the user acts and no card fits. Never run either after `codello ask`, `codello decide`, or `codello task`: each of those already shows the session waiting and sends the push. Also covers posting a step the user does by hand with `codello task`. Run `codello session-status set working -m \"<what it waits on>\" --until <when>` instead when the turn ends waiting on something that is not the user and that Codello cannot see, such as remote CI or another session's result, and `codello session-status progress <percent>` to show how far it has got. Clear a status with `codello session-status clear`. Also /codello:waiting."
---

# Declare what this session is waiting on

Codello shows the user a needs-you dot when a turn ends on a question or a permission prompt. It cannot see a wait that you describe in prose, and if anything you started is still running (a `Monitor`, a background `Bash`, a dev server) the session reads as busy however plainly your reply says otherwise, so the user is never told. The declaration replaces the inference.

```bash
codello session-status set blocked -m "Grant my role read access to the staging logs bucket"
codello session-status set waiting -m "PR ready for review: https://github.com/org/repo/pull/123"
```

The command arms the declaration and returns at once. It fires when the current turn ends, exactly as `codello done` does: the session row shows the status with your `-m` line, and one push goes out carrying the same line. A watcher firing does not retire it. While a turn that watcher starts runs, the row shows you working, and the declaration comes back with no second push when that turn ends.

## Ask with one command

Ask the user for something with exactly one command. That command alone shows the session waiting on the row and sends the push, and the wait ends when the user responds:

| You need the user to | Run | Then |
|---|---|---|
| Answer before your command can finish | `codello ask` | Wait in the command |
| Choose or approve something | `codello decide --file -` (the `decide` skill) | End your turn |
| Do a step by hand, such as signing in or approving on their phone | `codello task "<what to do>"` (below) | End your turn |
| Provide a credential | `codello secret request` (the `secrets` skill) | Follow the `secrets` skill |
| Read or do something that has no card, such as a PR to review or a report to read | `codello session-status set waiting -m "<what they must do>"` | End your turn |
| Act before work can go on, where no card fits | `codello session-status set blocked -m "<what they must do>"` | End your turn |

Never run `set waiting` or `set blocked` after `codello ask`, `codello decide`, or `codello task` to repeat it. A turn that posts cards may still set a status for a different need, such as two decision cards and a PR that is ready for review.

A request written only in your reply reaches nobody: the row shows nothing and no push goes out. Anything the turn leaves for the user goes through one of the commands above.

The two statuses look different on the user's devices:

- `blocked` shows red, the same as a permission prompt, and the push reads `Blocked · <session>` with your line. Use it when nothing more happens until the user acts.
- `waiting` shows amber. Use it when the user has something to do but your work is not stuck on it.

## Only the session's lead agent runs this

If another agent spawned you — as a subagent, a Task delegate, or a teammate — this command is not yours to run. You share the lead agent's session, so it reports the user's whole session rather than your piece of the work, and it does that while the lead is still working.

Report your result to the agent that spawned you and let it decide what the session ended as. The host refuses a delegate's report with `You are a delegate agent (a subagent or teammate), not this session's lead.` If you see that line, hand your result back instead.

## When to set it

Run it silently in the turn that leaves something only the user can do, before you write the final reply. Never mention the command or the status in the reply: "I've marked this session as waiting on your answer" tells the user nothing they need.

Set `blocked` when your work cannot continue until the user acts and no card fits:

- Access or a permission you cannot grant yourself: a denied command, an environment you cannot reach, an account you do not have, a change on a system outside your access.
- You are handing back a **Blocker** item.

A sign-in, an interactive login, or an MFA prompt is a `codello task` (below), and a credential is a `codello secret request` (the `secrets` skill); neither needs a status after it.

Set `waiting` when the user has something to do that has no card, and your work is not stuck on it:

- A pull request is open and needs their review, approval, or merge. One they have already approved, with the merge left to a process they run later, does not.
- The result of the task is something they have to read: findings from an investigation, the answer to a question they left you with, a report, a comparison, a plan, a recommendation. Reading it is the part only they can do, so the task is not done until they have. Say what is ready and lead with the headline, such as `Read: uploads fail on iPad because the picker returns no file. Two fixes compared.` A short answer in a live back-and-forth, where the user is plainly reading along, needs no declaration.

A question or a decision is not a status. Post every decision in one `codello decide --file -` call (the `decide` skill), with any text being approved in full in its `draft` (or in `details` on a multi-select decision, which takes no `draft`), keep the decisions out of your reply, and end the turn.

When both apply, set `blocked`: the user needs to know first that work has stopped.

Never set `waiting` or `blocked` for work you started yourself: CI on your own push, a `Monitor` or background command, a deploy, a subagent. When that work finishes you resume on your own, so the user is not the one you are waiting on, and the row would tell them it is their move while you keep working. Codello already shows a session parked on its own background command, `Monitor`, or subagent as busy. When nothing of yours runs on the host to watch it, declare `set working` instead (below). Set `waiting` only once something is left for the user, for example when CI is green and the PR is ready for review.

The same holds for a subagent, a teammate, or a review whose result you are waiting on, even when you already have something to ask the user. When that result can change what you ask them for, hold the `codello decide` cards until it arrives, and post them in that turn.

Never set it, or keep the session open on a timer, for a step of your own more than an hour away, such as a check tomorrow morning. Hand it off as the `done` skill says, then run `codello done`.

One declaration per wait. A second `set` replaces the status and the line on the row and sends another push, so declare once and declare again only when what the user has to do has changed, or when a declaration was dropped.

The declaration fires at the end of the turn. If the user types before the turn ends, the armed declaration is dropped: no dot, no push, because their message may already be the answer. If that message did not answer you, declare again in the next turn.

## A wait on something that isn't the user: `set working`

When the turn ends waiting on something other than the user, and nothing you started runs on this host to watch it, declare the wait so the row reads Working instead of turning amber:

```bash
codello session-status set working -m "CI run on PR 2087" --until 30m
```

- Use it for something you expect within the hour: remote CI with nothing polling it locally, a deploy, or another session's result.
- Skip it when your own background command, `Monitor`, or subagent is running: Codello already shows that session as busy, and it wakes you when the work ends.
- `--until` is required and at most one hour away. At that time Codello types you a prompt to check on the wait. Declare it again only when the thing is still due within the next hour. A wait that runs longer, or is on a person, such as a colleague's or a vendor's reply, is handed off with `codello schedule` and `codello done`, as the `done` skill says.
- No push goes out and no amber dot shows. A card, question, or task you open keeps its own color and push.
- `-m` names what you wait on, such as `CI run on PR 2087`. It is not a request to the user.
- Your next turn, for any reason, clears it. So do `codello session-status clear` and another `set`.
- The host refuses `codello done` in the same turn as `set working`: you are still waiting on something, so you are not done.

Expect:

```
[codello] Status set to working. When this turn ends the session shows as working, with no dot and no push.
[codello] At 3:40 PM CST Codello wakes this session to check on it. Your next turn, for any reason, clears it.
```

If it prints `this host does not support 'working' yet` (the host is older) or `codello: state must be 'waiting' or 'blocked'` (the CLI is older), don't declare a status. Never fall back to `set waiting`: that tells the user the wait is theirs. Instead, start a background command that waits for the thing, such as `gh run watch <run id> --exit-status` with `run_in_background: true`, and end the turn: its end wakes you, and Codello shows the session busy meanwhile.

### Show progress on the session's circle

`codello session-status progress <percent> [-m "<line>"]` fills a ring around the session's circle, with the percent and the line on the row. `progress clear` removes it. It starts no turn, sends no push, and never wakes you, so it can run as often as you like; it prints nothing on success.

Post it from a background command that polls the thing, so no turn of yours is spent on it. Start the command with `run_in_background: true` and `dangerouslyDisableSandbox: true`:

```bash
for _ in $(seq 120); do                      # one hour at most
  run=$(gh run view 123456 --json status,jobs) || { sleep 30; continue; }
  total=$(jq '.jobs | length' <<<"$run")
  finished=$(jq '[.jobs[] | select(.status == "completed")] | length' <<<"$run")
  [ "$total" -gt 0 ] && codello session-status progress $(( finished * 100 / total )) -m "$finished of $total jobs" || true
  [ "$(jq -r .status <<<"$run")" = completed ] && break
  sleep 30
done
```

Keep `|| true`: a host that predates progress exits 1 with `This host does not support progress yet`, and the script should go on polling. A failed `gh` call skips that round instead of posting 0, and the loop stops when the run completes or after an hour. An agent that checks the thing itself between turns can run the same command after each check instead.

After ten minutes with no post the ring turns gray, which tells the user the script stopped. 100 shows a full ring and ends nothing: the wait ends when your next turn starts. Your next turn also clears the progress; a script still running shows it again with its next post.

## Post a step the user must do by hand as a task

When the thing only the user can do happens away from the app, such as signing in to a site in a browser on the Mac, pairing an extension, putting a certificate on a machine, or approving in another app, post it with `codello task` and end the turn:

```bash
codello task "Sign in to USAA in Brave" --where mac --link https://www.usaa.com
```

The task shows the session waiting and sends the push itself, so set no status after it. The task is listed with the user's decisions and requests, across every session, with a **Done** button and, on a current host, **Can't do it**. Its text is Markdown. Start with one line that says what to do in a few words, starting with the verb; a hidden card shows only that line. When the task takes several clicks, follow that line with a blank line and a numbered list, one step per line, never a menu path written as a sentence (`Settings > Apps > Edit`):

```bash
codello task --where mac --link https://github.com/organizations/acme/settings/apps/acme-bot/permissions "$(printf '%s\n' \
  'Give the acme-bot GitHub App read access to commit statuses' \
  '' \
  '1. Under **Repository permissions**, set **Commit statuses** to **Read-only**' \
  '2. Click **Save changes**')"
```

`--where` says where it has to be done: `mac`, `phone`, or `anywhere`, the default; the user picks what to clear by where they are. `--link` is an https page that takes them to the first step, if one exists; the card shows it as an **Open** button, so leave the address out of the text. The command prints the task's id.

- When the user taps **Done**, your next prompt is the line `The user finished a task you gave them:` followed by `Done: <the task>`. Check that it worked before you go on.
- When the user taps **Can't do it**, the task is closed and your next prompt is the line `The user can't do a task you gave them:` followed by `Can't do: <the task>`. Don't post the same task again. Find another way to finish the work, or ask the user what to do next. Any reason they have comes as an ordinary chat message.
- Tasks closed together come in one prompt, one `Done:` or `Can't do:` line each, under `The user closed tasks you gave them:` when they were closed both ways.
- When you see it done another way, such as a sign-in that now succeeds, withdraw it with `codello task withdraw <id>` so the user isn't asked twice. `codello task list` shows this session's open tasks.
- While a task is open, `codello done` and `codello quit` are refused, and the refusal names each open task and its id.
- A session can have at most 8 open tasks.
- Post one task per thing the user finishes in one place. Steps on one page or in one app are one task with numbered steps; two steps the user does in two places are two tasks.

If `codello task` prints `error: unknown command 'task'` (the CLI predates tasks) or ``This Codello server does not support `codello task` yet`` (the host does), put the step in the `-m` line of `codello session-status set blocked` instead. Never run `codello restart` to get tasks: it restarts the user's host.

## When to clear it

Run `codello session-status clear` when the wait ends without the user typing in the session:

- The thing you were waiting for arrived another way: the PR got merged, CI finished, the blocker went away, a background task delivered what you needed.
- You are about to keep working on your own after all. Clear it before your first tool call in that turn, not at its end.

You do not need to clear it when the user replies. Their message, typed in the terminal or sent from the phone, retires the declaration on its own, and so do `codello done` and the user dismissing the session from the dashboard. If the next user message arrives and you still need something, declare again in that turn. A declaration their message retired stays retired: a later turn does not bring it back, including a turn that a background-task notification or a timer started. So if a turn ends still needing the same thing from the user and you have not declared since their last message, declare again in that turn. A request written only in your reply is not a declaration: no dot shows and no push goes out.

## In a task-mode session

A task-mode session was started with `codello spawn --task`, and its system prompt says so. Nobody reads its replies, so a turn may end in only these ways; any other turn end is sent back to you to continue:

- A `codello ask` question is waiting for the user. Use it for a question, a credential, or access: `codello ask "<question>"`, adding `--options "A|B"` when the choices are known. It waits up to 10 minutes and prints the answer, so give it a tool timeout of at least 600000 ms.
- `codello decide` cards are open or answered and not yet delivered. Post every decision in one call (the `decide` skill) and end your turn; the answers arrive as your next prompt.
- A `codello task` is open for a step the user does by hand. End your turn; tapping **Done** arrives as your next prompt.
- You declared a wait on something other than the user that you expect within the hour, such as remote CI, with `codello session-status set working -m "<what you wait for>" --until <at most an hour>`. If `working` is refused, start a background command that waits for it instead, as above. A longer wait, such as a colleague's or a vendor's reply, is a handoff with `codello schedule` and `codello done`.
- Work you started is still running, such as a subagent, a review, or a background shell. End the turn without declaring anything; its result arrives as your next prompt.
- `codello done` reported the work. When it leaves something for the user, such as a PR to review, put that action in `--next` (the `done` skill).

## Never in the same turn as done

`codello done` retires a declared status before it records its own outcome, so `set blocked` or `set waiting` followed by `done` in one turn leaves the session marked done with the declaration gone. They say opposite things: done means the user can close the session after reading only its `-m` line, blocked and waiting mean something is left for them. Pick one. The `done` skill's rule applies: an open PR, a follow-up, or a result they have to read means waiting, and work stopped on the user means blocked, not done. After you post `codello decide` cards, a `codello ask` question, or a `codello task`, end the turn: the host refuses `codello done` while any of them is open.

## Write the message for a lock screen

`-m` is the push the user reads, and the only one: your reply does not reach their lock screen. It is one line, read on a phone, out of context, possibly hours later, so put the substance of what you need from them in it. Say what the user has to do and name the thing: "Review and merge codello-plugin PR #12, the waiting skill" or "Approve the gh pr create permission" beats "Waiting on you".

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

Expect, for `set waiting`:

```
[codello] Status set to waiting. When this turn ends the session shows as waiting on you and you are notified.
[codello] It stays that way until you reply, or the agent runs `codello session-status clear` or `codello done`.
```

For `set blocked`:

```
[codello] Status set to blocked. When this turn ends the session shows as blocked on you and you are notified.
[codello] It stays that way until you reply, or the agent runs `codello session-status clear` or `codello done`.
```

And for `clear`, one of:

```
[codello] Declared status cleared. This session goes back to the state Codello infers.
```

```
[codello] No declared status to clear.
```

Nothing is armed until the `set` line prints.

If `set blocked` exits 1 because Codello is too old for it, run `codello session-status set waiting` with the same `-m` line, and do not end the turn yet. When the Codello server on the host predates `blocked`, the output says "does not support 'blocked'", and names the command to run with your own line in place of `<your message>`:

```
codello: this host does not support 'blocked' yet. Update the host, or run: codello session-status set waiting -m "<your message>"
```

When the `codello` CLI itself predates `blocked`, the output says:

```
[codello] Unknown status 'blocked' — the only declarable status is 'waiting'
```

If the command prints anything else, say so in your reply and end the turn normally:

- `Not in a Codello session`: Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session can declare a status.
- `Codello is not running on this host` (older CLIs print `Server not running`): Codello is down on this host, so there is nothing to record the declaration.
- `A cursor session cannot declare a status`: the host predates Cursor support, which needs a Codello CLI restarted after [COD-1539](https://linear.app/masonsystems/issue/COD-1539/). State the wait in your reply instead. On a current host a Cursor session declares like Claude Code and Codex, and the declaration fires when an interactive turn completes. A `cursor-agent --print` run never fires it, so state the wait in your reply there too.

## Options

| Command | Purpose |
|------|---------|
| `codello session-status set blocked -m <text>` | Declare that work has stopped until the user acts; `-m` is the one line shown on the row and in the push |
| `codello session-status set waiting -m <text>` | Declare that the user has something to do; `-m` is the one line shown on the row and in the push |
| `codello session-status set working -m <text> --until <when>` | Declare a wait on something that is not the user; no dot, no push, and a wake-up at `--until`, at most an hour away |
| `codello session-status progress <percent> [-m <text>]` | Fill the ring on the session's circle; `progress clear` removes it |
| `codello session-status clear` | Withdraw the declaration and any progress; the session goes back to what Codello infers |

## Related

`/codello:done` reports an outcome when nothing is left for the user. `/codello:quit` ends the session outright after a task the user asked you to finish and quit. `codello snooze` is the opposite of this skill: it hides a session that is waiting on something Codello cannot see, so the user is not surfaced for a wait that is not theirs.
