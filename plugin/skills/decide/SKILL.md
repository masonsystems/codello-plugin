---
name: decide
description: "Post every decision only the user can make in one `codello decide --file -` call, a JSON list read from stdin, with any text the user approves in full in each decision's `details`; then `codello session-status set waiting`. The user answers on their phone, and every answer comes back to you as one prompt. Never list the decisions in your reply, and never write \"see the reply\" in a decision. Needs a `codello` CLI with the `decide` command."
---

# Put decisions to the user

`codello decide` posts decisions to the user's phone and browser and returns at once. You keep working or end your turn. The user answers each decision with a tap or in their own words, and the answers come back to you later as one prompt:

```
Answers to your decisions:
1. The cache key ignores the locale, so French users get English pages. Recommend a… → Add the locale
2. Two unrelated fixes are on this branch. Recommend shipping them in one PR. → (dismissed by you on iPhone)
```

The prompt arrives when the user has answered or dismissed every open decision, when they tap Send answers to send what they have answered so far, or ahead of the next message they type.

A dismissed decision says who dismissed it:

- `(dismissed by you on <device>)` or `(dismissed by you)`: the user skipped it. That is their answer. Don't post the decision again unless they ask you to.
- `(dismissed by Codello: <reason>)`: Codello ended the card without the user. Post it again if you still need the answer.
- `(dismissed)`: a host older than this text; the source is unknown. Treat it as the user's Skip.

## When to use it

Use it for a decision only the user can make that you would otherwise write into your reply and leave for them to answer in prose. Use `codello ask` instead when you must have the answer before you can do anything else in this turn; it waits for the answer and prints it.

Use it too when a command you need was blocked and only the user can allow it. A request written in your reply reaches nobody: the user reads the card, not the terminal. Ask in plain words what the command does and what it unblocks ("Let me read the failing check from the linter's API, so I can fix the last red check on PR #412?"), and put the exact command in `details`. Never ask the user to "allow the blocked command" with no account of what it does. On November 9, 2026, a session asked twice in its replies for two blocked commands, and the user answered "I don't know what you're asking me."

Post only decisions about your own work. When your work waits on another session's, such as a pull request that session opened and that has to merge before yours can, the decision is that session's. Check that the session is still open with `codello ls`; if it is, say in your reply that you're waiting on it, and if you declare a wait, name that session in the `-m` line ("waiting on <session>'s PR #734") instead of asking for the merge. Don't post a card asking to merge, deploy, or approve something another session owns, even when that session looks idle; its own card is usually already open. Post it yourself only when the user asked you to, or when the owning session has closed with the work still open. On November 7, 2026, three sessions waiting on one PR each posted a merge card beside the card from the session that opened it, and the user answered the same question four times.

## Write each decision so the user can act on it cold

The user reads each decision alone, on a phone, possibly hours later, without your reply or the code in front of them. The card renders each decision's `question` as Markdown, so write it in three parts:

1. A one-line ask that names the thing: the file, the PR, the flag, the service.
2. Two to four `- ` bullets: why it matters (what goes wrong, or what it costs), and what each option does. When the decision comes from someone else's request, an email, or an earlier day's work, the first bullet says where it came from: who asked, when, and what. Without it the user can't tell what the card is about; on November 8, 2026 a follow-up card from a maintenance session reached the user with no origin, and they had to ask what it was for.
3. A `Recommended: …` line.

```markdown
Switch the integration tests from SQLite to Postgres?

- **Why:** the JSON column queries in reports.ts never run against SQLite, so they are untested.
- **Switch:** tests match production; each run takes about 20 seconds longer.
- **Keep SQLite:** runs stay fast; the JSON queries stay untested.

Recommended: Switch to Postgres.
```

Keep the question that short. Anything longer, such as a multi-step plan, a list of files, or draft text, goes in `details`.

Give 1 to 3 `options`. Put your recommendation first; the card marks the first option Recommended. Leave `options` out when the answer is open-ended. The user can always type their own answer, or skip the decision, so every option is a real answer: never an "Other" option, and never a bare "Recommended" one. A current CLI refuses both.

Write each option as `Label: one-line description`, so a tap on it makes sense without the question above:

- The label names the choice in a few words. Never a bare letter or number such as `A` or `Option 2`, which means nothing on the card.
- The description says what that choice does or costs, in one line. Keep the whole option under 120 characters, which every Codello version shows in full.
- Never write `(recommended)` in an option. The card already marks the first option Recommended, and the words would show twice.

## Put the text being approved, and anything longer, in `details`

When a decision rests on a multi-step plan or other material longer than the bullets, put it in `details`. When a decision approves text (an email, a ticket comment, a PR description, a message), put that text in full in the decision's `details`, as Markdown: recipients, subject, and body. The card shows it behind a Details toggle under the question. Never write "see the reply", "the draft above", or "the note I drafted earlier": the user answers from the card, and your reply may be hours of scrolling away. `details` holds up to 16 KB.

## Post every decision in one call

Post all of a turn's decisions in one call, with a JSON list on stdin. Each entry has a `question`, and optionally `options` (a list of 1 to 3 strings) and `details`. The CLI checks every entry before it posts anything, so one bad entry posts none of them; fix it and run the call again. A quoted heredoc keeps the shell from touching the text:

```bash
codello decide --file - <<'JSON'
[
  {
    "question": "Switch the integration tests from SQLite to Postgres?\n\n- **Why:** the JSON column queries in reports.ts never run against SQLite, so they are untested.\n- **Switch:** tests match production; each run takes about 20 seconds longer.\n- **Keep SQLite:** runs stay fast; the JSON queries stay untested.\n\nRecommended: Switch to Postgres.",
    "options": ["Switch to Postgres: tests match production, runs take 20 seconds longer", "Keep SQLite: fast runs, JSON queries stay untested"]
  },
  {
    "question": "Send Dana the reply about when the export fix ships?\n\n- **Why:** she asked for a date, and the reply promises Thursday.\n- **Send it:** Dana gets the date today.\n- **Hold it:** no promise until the fix merges.\n\nRecommended: Send it.",
    "options": ["Send it: Dana gets the date today", "Hold it: no promise until the fix merges"],
    "details": "**To:** dana@example.com\n\n**Subject:** Re: Export fix\n\nHi Dana,\n\nThe export fix ships Thursday."
  }
]
JSON
```

A lone decision can also go on the command line: `codello decide "<question>" --options "A|B" --details "<markdown>"`. Write `\n` line breaks in the JSON string; on the command line, use real line breaks inside the quotes.

## Keep the ids, and change a decision in place

`codello decide` prints one decision id per line. Keep them: you need an id to change a decision you already posted. If you lost them, `codello decide list` prints each decision of this session that has not reached you yet, one per line with its id, status, and question; `--json` prints the same as JSON. To see other sessions' cards, `codello decide list --all` lists every live session's, and `--session <id or prefix>` one session's, with the session's name and when each card was posted. Those only read: you can revise or withdraw only your own session's decisions.

When you learn something that changes a decision you already posted, change that decision. Never post a new decision that says it replaces, supersedes, or corrects an earlier card: the user would see both cards and could answer the stale one.

- **To correct or replace a decision**, run `codello decide revise <id>` with the new decision, either as a paragraph with `--options` and `--details`, or with `--file` holding one entry in the same JSON shape. The card keeps its place and shows a Revised mark. If the user already answered it, the answer is cleared and the decision is open again.
- **To drop a decision** that no longer matters, run `codello decide withdraw <id>`, with several ids at once if you need. The card disappears.

```bash
codello decide revise 0adade9b-0eb3-477e-bd9d-f41c218db451 --file - <<'JSON'
{
  "question": "Switch the integration tests to MySQL?\n\n- **Why:** CI already runs MySQL, so the tests would match it.\n\nRecommended: Switch to MySQL.",
  "options": ["Switch to MySQL: tests match CI", "Keep SQLite: fast runs"]
}
JSON
codello decide withdraw 162d5b7d-754b-4d25-b885-d66f1b12715e
```

Both exit 0 when the change is made. Exit 1 changes nothing, and stderr names each id it refused and why: an id that is not one of this session's open or answered decisions (it may already have reached you; its answer is in the prompt you got or will get), answers that are already on their way to you, a revise that would reopen an answered decision past the per-session limit on open decisions, or a Codello server too old for these commands, which says to run `codello restart`. When an answer already reached you, act on it or post a new decision about what changed; when answers are on their way, wait for them.

## Then declare the wait, and keep the decisions out of your reply

After the `codello decide` call, run `codello session-status set waiting -m "<n> decisions are waiting on you"` before your final reply (the `waiting` skill). The decisions are already on the user's phone. Never repeat or list them in your reply: the user would read each one twice and could answer the copy that never reaches you.

## Reading the result

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server, which a sandboxed command cannot reach.

- Exit 0 means the host holds every decision. stdout is one decision id per line, in the order you posted them, and nothing else.
- Exit 1 means nothing was posted, and stderr says why: a bad entry (each one is named), not in a Codello session, Codello not running, or a Codello server too old to take decisions. Fix a bad entry and post again. If the CLI rejects `--file` or `--details` as an unknown option, it is too old for them: post one `codello decide "<question>" --options "..."` per decision instead, and put any text being approved in that question. Otherwise put the decisions in your reply, and say what stopped the command.

## Options

| Command | Purpose |
|------|---------|
| `codello decide --file -` | Post a JSON list of decisions read from stdin, in one call |
| `codello decide --file <path>` | The same, read from a file |
| `codello decide "<question>"` | Post one decision the user answers in their own words |
| `codello decide "<question>" --options "A\|B\|C"` | Offer up to 3 options; the first is your recommendation |
| `codello decide "<question>" --details "<markdown>"` | Show the text being approved behind a Details toggle |
| `codello decide revise <id> "<question>" --options "A\|B"` | Replace a decision you posted, keeping its id and place |
| `codello decide revise <id> --file -` | The same, with one JSON entry read from stdin |
| `codello decide withdraw <id>...` | Remove decisions you posted; all or none |
| `codello decide list [--json]` | List this session's decisions that have not reached you, with their ids |
| `codello decide list --all [--json]` | List every live session's decisions that have not reached their agent; read-only |
| `codello decide list --session <id> [--json]` | The same for one session, by id or prefix |

## Related

`codello ask` asks a question and waits for the answer. `/codello:waiting` declares that the session needs the user once your turn ends.
