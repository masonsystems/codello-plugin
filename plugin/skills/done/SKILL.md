---
name: done
description: "Run `codello done`, or `codello done --failed`, at the end of a turn only when the task is finished and the user can close the session after reading only the `-m` line: no PR to review, no open question, no unanswered decision card, and no findings, answer, or report they still have to read. With a card, question, or task open, end the turn; for anything else pending, set waiting instead. Marks the session done (green check) or failed (red ✕). Also /codello:done."
---

# Report what this session ended as

`codello done` puts the outcome on the session's row, so the user learns what happened without opening it.

```bash
codello done -m "Fixed the parser crash and merged the pull request."
```

```bash
codello done --failed -m "The staging database is unreachable, so the migration never ran."
```

The command arms the outcome and returns at once. It lands when the current turn ends, so run it and then write your reply as normal. The user may close a done session without opening it, so nothing they need can live only in that reply.

## Only the session's lead agent runs this

If another agent spawned you — as a subagent, a Task delegate, or a teammate — this command is not yours to run. You share the lead agent's session, so it reports the user's whole session rather than your piece of the work, and it does that while the lead is still working.

Report your result to the agent that spawned you and let it decide what the session ended as. The host refuses a delegate's report with `You are a delegate agent (a subagent or teammate), not this session's lead.` If you see that line, hand your result back instead.

## Done means the user can close the session without reading it

Before you run `codello done`, ask one question: can the user close this session after reading only the `-m` line? Run it only when the answer is yes. That is stricter than "I finished my part," and stricter than "I have nothing more to do."

Do **not** run `codello done` when any of these is true:

- The result of the task is something the user has to read: findings from an investigation, the answer to a question they asked, a report, a comparison, a plan, a recommendation. You finished gathering it, but they have not read it, and a done session tells them they do not need to.
- A pull request is open and waiting for the user to review, approve, or merge it. A pull request the user has already approved, where the merge is left to a process they run later (such as a merge queue), no longer waits on them; once you have recorded the approval the project asks for, run `codello done`.
- There is a follow-up for them: a command to run, a credential to add, a setting to change, a deploy to approve.
- You asked a question, or a decision is theirs to make.
- A `codello decide` card or a `codello ask` question is still unanswered, or a `codello task` is still open.
- You want them to check, confirm, or look at something.
- Part of the work is unfinished, deferred, or blocked, and the next step is the user's.

Work of your own that is still running is not a reason to declare a wait: keep working, and run `codello done` when it finishes. In each of the cases above, ask with the one command that fits and end the turn (the `waiting` skill, `/codello:waiting`): a question or decision goes on a `codello decide` card, a step by hand in a `codello task`, and a card, question, or task already open needs nothing more. For something with no card, such as a PR to review or a result to read, run `codello session-status set waiting -m "<what the user has to do or read>"`, or `set blocked` when your work cannot continue until the user acts. Marking such a session done is worse than saying nothing: it tells them there is nothing to come back for, and the session removes itself a day later.

The host enforces the unanswered-card item. While any decision card, question, or `codello task` is open, or the user's answers have not reached you yet, `codello done` and `codello done --failed` are refused, and nothing is recorded. A card, question, or task you post after running `codello done` in the same turn drops that done when the turn ends, and nothing tells you so at that point. End the turn instead, and run `codello done` again once the answers arrive and nothing is left for the user.

The same request can end either way. What decides it is what the user still has to take in:

| The user asked | How it ended | Report |
|---|---|---|
| Fix the flaky upload test | Fixed, and the fix is merged | `codello done -m "Fixed the flaky upload test: the mock clock was shared between cases."` |
| Find out why uploads fail on iPad | The cause and two possible fixes are written up in the reply | `codello session-status set waiting -m "Read: uploads fail on iPad because the picker returns no file. Two fixes compared."` |
| Find out why uploads fail on iPad, and fix it | Fixed and merged, and the cause fits in one line | `codello done -m "Uploads on iPad work again: the picker returned no file, now handled."` |

A short answer in a live back-and-forth, where the user is plainly reading along, needs neither command: end the turn normally.

When another agent or session started this one and reads its report, that agent is the reader, not a person: run `codello done` and put the result itself in `-m`, since that report is what goes back to it. The one-line test above does not apply, so `-m` may run as long as the result needs.

Before you run `codello done`, stop any wake-up you scheduled for this task: `ScheduleWakeup` with `stop: true`, `CronDelete` for a cron job you made, and `codello timer cancel <id>` for a timer you set on this session. A fallback wake-up left running fires after the report and restarts finished work.

## A step more than an hour away does not keep the session open

Never keep a session open, or set a timer on it, for a step more than an hour away, such as a check tomorrow morning or a change in tonight's maintenance window. A session that waits hours sits on the user's list with nothing to do. Hand the step off instead, then run `codello done` once nothing else is due within the hour and no question or decision is open:

- **Schedule a fresh session for it** with `/codello:schedule`, which picks background or interactive and checks the run's permissions. The new session has no memory of this one, so the seed carries everything it needs: the task, what is done so far, the PR and ticket numbers, and the user's answers.
- **Or, when another agent or session started this one and acts on its report**, put the time and the step in the `-m` summary, such as `Later: 9:00 AM tomorrow: confirm the nightly report ran with the fix`, and let it schedule the step. When a person started this session, schedule the step yourself: a line in the summary sends them no push.

A step handed off either way is not unfinished work or a follow-up under the list above. Cancel any timer or wake-up you set for it before you run `codello done`.

## In a task-mode session, done is how every task ends

A task-mode session was started with `codello spawn --task`, and its system prompt says so. There the rule under "Done means the user can close the session without reading it" is replaced: nobody reads your replies, so the work is never handed back in prose. When the work is finished, report it with `codello done`, even when it leaves something for the user, and put that something in `--next`:

```bash
codello done -m "Fixed the race in the upload test" --tests "npm test: all passed" --next "Review and merge the PR" --link "https://github.com/org/repo/pull/12"
```

The report shows as a card on the task's session, sends the user a push, and is typed into the chat session that started the task, if there is one. A turn that ends with no `codello done`, no `codello ask` waiting, no open `codello decide` card or `codello task`, no declared wait, and no work of yours still running (a subagent, a review, a background shell) is sent back to you to continue; the `waiting` skill lists each way a task's turn may end. Never ask in your reply: ask with `codello ask` (see `codello ask --help`), or post `codello decide` cards or a `codello task` and end the turn.

## Failed means you could not do it

Use `--failed` when the task cannot be completed as asked — a dependency that does not exist, an environment you cannot reach, an approach that turned out to be impossible. A failed session sends the user a push, because they have been waiting on work that is not coming.

Do not use `--failed` for work you merely have not finished yet, or for a task that is blocked on the user. Blocked is not failed: leave the session open and ask with the one command that fits (the `waiting` skill, `/codello:waiting`): a `codello task` for a step the user does by hand, or `codello session-status set blocked -m "<what you need>"` when no card fits, so the session row shows it even while a background task of yours keeps the session looking busy. Never run `done` and `set blocked` or `set waiting` in the same turn: `done` retires the declaration.

## What each outcome does

| Command | Indicator | Push | Session |
|---|---|---|---|
| `codello done` | Green check | None — the check is there when they next look | Closes itself after 24 hours, unless the user opens it or types in it |
| `codello done --failed` | Red ✕ | `Failed · <session>`, with your summary as the body | Stays open |
| `codello done` in a task | Green check and the report card | `Done · <session>`, with your summary as the body | As for `codello done`; the report goes to the session that started the task |
| `codello done --failed` in a task | Red ✕ and the report card | As for `--failed` | Stays open; the report goes to the session that started the task |

Either outcome clears the moment the user types in the session, like any other indicator. A session blocked on a permission prompt, a question, or a decision card still reads as blocked; that outranks both.

## Running it

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach.

Expect one of:

```
Task reported as done. When this turn ends the session is marked done; it closes itself in 24 hours. If you post a decision card or a question before this turn ends, the done is dropped: the card already shows the session waiting, so end your turn, and run `codello done` again once the answers arrive and nothing is left for the user.
```

```
Task reported as failed. When this turn ends the session is marked failed and you are notified. If you post a decision card or a question before this turn ends, the failure is dropped: the card already shows the session waiting, so end your turn, and run `codello done` again once the answers arrive and nothing is left for the user.
```

An older CLI prints only the first two sentences. Nothing is armed until that line prints. If the command prints anything else, report exactly what it said and end the turn normally:

- `Not reported as done. 8 decision cards are still waiting on the user, ...`: the user has not answered every card or question yet, or a task is still open. End the turn and set no status: what is open already shows the session waiting. Run `codello done` after the answers arrive and nothing else is left.
- `Not reported as done. The user answered your decision cards, and 2 answers are on the way to you ...`: the answers reach you as your next prompt. End the turn without `codello done`, act on them when they arrive, and run `codello done` then if nothing is left.
- `Not in a Codello session`: Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session can report an outcome.
- `Codello is not running on this host` (older CLIs print `Server not running`): Codello is down on this host, so there is nothing to record the outcome.

## Write the summary for a lock screen

`-m` is one line, read on a phone, out of context, possibly a day later. It is often all the user reads before they close the session, so it carries the whole outcome.

- **If one line cannot carry what the user needs to know, the session is not done.** Set waiting and let them read the reply.
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

`/codello:quit` ends the session outright at the same boundary, leaving no record of an outcome. Use `/codello:done` when the `-m` line tells the user everything they need, so they can close the session unread; use `/codello:quit` when the user told you to go away and there is nothing worth coming back to. `/codello:waiting` is for the turns this skill tells you not to run `done` on: it declares that the session needs the user, and what for.
