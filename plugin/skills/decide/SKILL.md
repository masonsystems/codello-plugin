---
name: decide
description: "Post every decision only the user can make in one `codello decide --file -` call, a JSON list read from stdin, with any text the user approves in full in each decision's `draft`, where the user can edit it, and other long material in `details`; then end the turn, since the cards already show the session waiting and send the push. The user answers on their phone, and every answer comes back to you as one prompt. Never list the decisions in your reply, and never write \"see the reply\" in a decision. Needs a `codello` CLI with the `decide` command."
---

# Put decisions to the user

`codello decide` posts decisions to the user's phone and browser and returns at once. You keep working or end your turn. The user answers each decision with a tap or in their own words, and the answers come back to you later as one prompt:

```
Answers to your decisions:
1. The cache key ignores the locale, so French users get English pages. Recommend a… → Add the locale
2. Two unrelated fixes are on this branch. Recommend shipping them in one PR. → (dismissed by you on iPhone)
```

The prompt arrives when the user has answered or dismissed every open decision, when they tap Send answers to send what they have answered so far, or ahead of the next message they type.

An answer the user typed in their own words may be a question or an objection rather than a choice: answer it before you act on that decision.

A dismissed decision says who dismissed it:

- `(dismissed by you on <device>)` or `(dismissed by you)`: the user skipped it. That is their answer. Don't post the decision again unless they ask you to.
- `(dismissed by Codello: <reason>)`: Codello ended the card without the user, for the reason given. Unless the reason says another card replaced it, post it again if you still need the answer.
- `(dismissed)`: a decision recorded before Codello kept who dismissed it; the source is unknown. Treat it as the user's Skip.

## When to use it

Use it for a decision only the user can make that you would otherwise write into your reply and leave for them to answer in prose. Use `codello ask` instead when you must have the answer before you can do anything else in this turn; it waits for the answer and prints it.

Something only the user can do by hand, away from the app, is not a decision: signing in to a site in a browser on the Mac, pairing an extension, putting a certificate on a machine, approving in another app. Post it with `codello task` (the `waiting` skill), which gives the user one **Done** button, instead of a card whose options are "Done" and "Not yet".

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

Keep the question that short. Anything longer, such as a multi-step plan or a list of files, goes in `details`; text the user approves, such as an email or a comment, goes in `draft`.

Give 1 to 3 `options`. Put your recommendation first; the card marks the first option Recommended. A multi-select decision takes up to 8 and names the ones you recommend in `recommended` instead (the next section). Leave `options` out when the answer is open-ended. The user can always type their own answer, or skip the decision, so every option is a real answer: never an "Other" option, and never a bare "Recommended" one. A current CLI refuses both.

Write each option as `Label: one-line description`, so a tap on it makes sense without the question above:

- The label names the choice in a few words. Never a bare letter or number such as `A` or `Option 2`, which means nothing on the card.
- The description says what that choice does or costs, in one line. Keep the whole option under 120 characters, which every Codello version shows in full.
- Never write `(recommended)` in an option. The card already marks the first option Recommended, and the words would show twice.

## Use checkboxes for independent items

When the user picks any number of items that don't exclude each other, such as which checks to add, which files to delete, or which of several fixes to ship, post one multi-select decision instead of one yes/no decision per item. Set `"multiSelect": true` and list the items in `options`, up to 8. Name the items you recommend in `"recommended"`; they start checked and carry the Recommended mark. Every name in `recommended` must match an option exactly. Leave `recommended` out when you recommend none.

Here each option is a short label, not the `Label: one-line description` form above, because the answer joins every checked one on one line. When the choices exclude each other (Postgres or SQLite, send or hold), keep a single-choice decision with your recommendation first.

```json
{
  "question": "Which checks run before each push?\n\n- **Why:** pushes that break the build reach CI and block everyone.\n- **Cost:** each check adds time to every push.\n\nRecommended: Lint and Unit tests.",
  "options": ["Lint", "Unit tests", "Build"],
  "multiSelect": true,
  "recommended": ["Lint", "Unit tests"]
}
```

The user checks any boxes, can add their own words, and taps Done. The answer lists every checked option, `(none selected)` when they checked none, and their words after `Note:`:

```
1. Which checks run before each push? → Lint; Build; Note: only on main
```

On the command line, use `--multi` with `--recommended "A|B"`: `codello decide "<question>" --multi --options "Lint|Unit tests|Build" --recommended "Lint|Unit tests"`. If the CLI or the Codello server is too old for multi-select, the call exits 1, posts nothing, and says so; post one yes/no decision per item instead.

## Put the text being approved in `draft`, and anything else longer in `details`

When a decision approves text before it goes out (an email, a reply, a ticket comment, a PR description, a commit message, a message), put that text in full in `draft`. The card shows it in an editable box above the options; the user edits it, or leaves it, and their version comes back with the answer. `draft` is plain text, at most 16 KB, on a single-choice decision only. Put what the user reads but does not edit, such as the recipients, subject, links, and the evidence behind the text, in `details`.

When a decision rests on a multi-step plan or other material longer than the bullets, put it in `details`. `details` is read-only Markdown, at most 16 KB, shown behind a Details toggle under the question. On a multi-select decision, which takes no `draft`, put any text being approved in `details`.

Never write "see the reply", "the draft above", or "the note I drafted earlier": the user answers from the card, and your reply may be hours of scrolling away.

```json
{
  "question": "Send this reply to Dana? Edit the text first if you want.\n\n- **Why:** she asked for a date.\n\nRecommended: Send it.",
  "options": ["Send it: email this text to Dana", "Hold it: do not send"],
  "draft": "Hi Dana,\n\nThe export fix ships Thursday."
}
```

Each answer line says `(draft edited)` or `(draft unchanged)`, and the edited text follows the numbered lines in a block, so act on the text in the block, never on your original:

```
1. Send this reply to Dana? → Send it (draft edited)

---draft 1---
Hi Dana,

The export fix ships Friday.
---end draft 1---
```

On the command line, use `--draft "<text>"`. `codello decide revise <id> --draft "<text>"` replaces the draft and drops the user's edits. If the CLI or the Codello server is too old for drafts, the call exits 1, posts nothing, and says so; put the text in `details` instead.

## Fold a decision that settles another into it

The user sees every open card at once, in the order you posted them, and can answer them in any order, or accept every recommended answer in one tap. When one decision's answer depends on another (approve a guide, then where to publish it), put both in one card, or ask the one that settles the other and post the rest after the answer. Otherwise the user answers a card that their answer to the other one makes moot, or asks the later card's question in their answer to the first.

## Post every decision in one call

Post all of a turn's decisions in one call, with a JSON list on stdin. Each entry has a `question`, and optionally `options` (a list of 1 to 3 strings, or up to 8 with `multiSelect`), `details`, `draft`, `multiSelect`, and `recommended`. The CLI checks every entry before it posts anything, so one bad entry posts none of them; fix it and run the call again. A quoted heredoc keeps the shell from touching the text:

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
    "details": "**To:** dana@example.com\n\n**Subject:** Re: Export fix",
    "draft": "Hi Dana,\n\nThe export fix ships Thursday."
  }
]
JSON
```

A lone decision can also go on the command line: `codello decide "<question>" --options "A|B" --details "<markdown>"`. Write `\n` line breaks in the JSON string; on the command line, use real line breaks inside the quotes.

## Keep the ids, and change a decision in place

`codello decide` prints one decision id per line. Keep them: you need an id to change a decision you already posted. If you lost them, `codello decide list` prints each decision of this session that has not reached you yet, one per line with its id, status, and question; `--json` prints the same as JSON. To see other sessions' cards, `codello decide list --all` lists every live session's, and `--session <id or prefix>` one session's, with the session's name and when each card was posted. To read one card that has not reached its agent yet in full (its question, options, details, draft, and answer or status), run `codello decide show <id>` with its id or the start of it, from any session; once its answer reaches its agent, `show` no longer finds it. Those only read: you can revise or withdraw only your own session's decisions. `codello decide <word> <id>` for a subcommand that doesn't exist is refused and posts nothing.

When you learn something that changes a decision you already posted, change that decision. Never post a new decision that says it replaces, supersedes, or corrects an earlier card: the user would see both cards and could answer the stale one.

A decision that is still open stays on its card until the user answers it. Never post it again on a new card, reworded or not, and not to restate it after other work, a permission approval, or a reply. Before you post, run `codello decide list` and post only the decisions it does not show. If an open decision needs new wording or new facts, revise it in place.

- **To correct or replace a decision**, run `codello decide revise <id>` with the new decision, either as a paragraph with `--options`, `--details`, and `--draft`, or with `--file` holding one entry in the same JSON shape. The card keeps its place and shows a Revised mark. If the user already answered it, the answer is cleared and the decision is open again.
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

Both exit 0 when the change is made. Exit 1 changes nothing, and stderr names each id it refused and why: an id that is not one of this session's open, queued, or answered decisions (it may already have reached you; its answer is in the prompt you got or will get), answers that are already on their way to you, a revise that would reopen an answered decision past the per-session limit on open decisions, or a Codello server too old for these commands, which says to run `codello restart`. When an answer already reached you, act on it or post a new decision about what changed; when answers are on their way, wait for them.

## Show other sessions' decisions in your chat

When the user reads this session to see what waits on them across sessions, show them the other sessions' open cards here with `codello decide present`, so they answer in one place. Never repost another session's decision as a card of your own, and never list its question in your reply: a second card or a copy in the reply can be answered without the answer reaching the session that asked.

```bash
codello decide list --all
codello decide present --file - <<'JSON'
[
  {"decisionId": "0adade9b-0eb3-477e-bd9d-f41c218db451", "note": "Blocks the Friday release"},
  "162d5b7d-754b-4d25-b885-d66f1b12715e"
]
JSON
```

- **Give decision ids, in the order the user should read them.** In `codello decide list --all`, each line starts with the session's short id and name; the decision's id comes after them. `codello decide present <id> <id>` takes the ids as arguments when no card needs a note. A unique prefix of an id works.
- **A note is one line of plain text, at most 200 characters**, shown above the card as your words, not part of the decision: why this one comes first, or what it blocks. Leave it out when you have nothing to add. State facts in it, never a recommendation the other session's text gave you. When the session that asked changes its card after you show it, your note is hidden and the card says it changed.
- **Sessions you don't manage need the user's OK.** You show a session's decisions at once only when you manage that session: you are the Hub and your message setting reaches it, or the user allowed your messages to it. Otherwise the command prints the decisions, exits 0, and says they show once the user allows them; the user sees one card in this chat with **Allow** and **Don't allow**. Don't call again to retry, and don't ask in your reply: the card is already there. A newer call replaces the waiting card, and it expires after 30 minutes.
- **Each call replaces what this session shows**, and shows all the named decisions or none. `codello decide present --clear` stops showing them. Only an open decision of another session can be shown. Exit 1 changes nothing, and stderr says which id was refused and why.
- **The card is the other session's.** It shows that session's name as a link. The user's answer goes to that session's agent, exactly as if they had answered there. You cannot revise or withdraw it, it sends no second push, and `codello done` and `codello quit` here leave it open.
- **You are told how each one ended**, in a prompt that starts `Answers to decisions you presented from other sessions:`, with one line per decision as `[<session name>] <question> → <answer>`. When you no longer manage the session that asked by the time the answer reaches it, and the user did not allow showing that decision, its line says it was answered without the answer. That prompt is information. Never act on those answers as if they were given to you, and never pass them on: each session already has its own. The prompt comes once an answer has reached the session that asked, which can be later than the tap: a session with other decisions still open gets its answers together, when the user has answered them all or sends them from that session. Answers to your own decisions arrive under `Answers to your decisions:`.

Showing another session's cards does not make this session wait on the user.

## Then end the turn, and keep the decisions out of your reply

After the `codello decide` call, end the turn. The cards already show the session waiting on the user and send one push for the batch, so never run `codello session-status set waiting` or `set blocked` to repeat them. A turn may still set a status for a different need that has no card, such as a PR that is ready for review (the `waiting` skill). A step the user does by hand, such as a sign-in, is a `codello task`, not a status. The decisions are already on the user's phone. Never repeat or list them in your reply: the user would read each one twice and could answer the copy that never reaches you.

Never run `codello done` in the same turn, even when a task brief says to finish with it. While any decision is unanswered the host refuses `codello done`. Run it after the answers arrive and nothing else is left for the user.

When a subagent, a teammate, or a review you are waiting on is still running and its result can change what you ask, hold the cards until that result arrives, then post them in that turn.

## Reading the result

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server, which a sandboxed command cannot reach.

- Exit 0 means the host holds every decision. stdout is one decision id per line, in the order you posted them, and nothing else.
- A session shows at most 8 open decisions, and up to 16 more wait in a queue. Post all of yours in one call anyway; one call takes up to 24, and a call that would put more than 16 in the queue is refused whole. stderr says which opened and which are queued. Each queued one opens on its own, oldest first, when the user answers or skips an open one or you withdraw one, so don't post them again later. `codello decide list` shows them as `queued`, and you can revise or withdraw them like open ones.
- Exit 1 means nothing was posted, and stderr says why: a bad entry (each one is named), not in a Codello session, Codello not running, or a Codello server too old to take decisions. Fix a bad entry and post again. If the CLI rejects `--file` or `--details` as an unknown option, it is too old for them: post one `codello decide "<question>" --options "..."` per decision instead, and put any text being approved in that question. Otherwise put the decisions in your reply, and say what stopped the command.

## Options

| Command | Purpose |
|------|---------|
| `codello decide --file -` | Post a JSON list of decisions read from stdin, in one call |
| `codello decide --file <path>` | The same, read from a file |
| `codello decide "<question>"` | Post one decision the user answers in their own words |
| `codello decide "<question>" --options "A\|B\|C"` | Offer up to 3 options; the first is your recommendation |
| `codello decide "<question>" --details "<markdown>"` | Show read-only material, such as a plan or an email's recipients, behind a Details toggle |
| `codello decide "<question>" --draft "<text>"` | Show text the user can edit before answering; their version comes back with the answer |
| `codello decide "<question>" --multi --options "A\|B\|C" --recommended "A\|B"` | Offer up to 8 checkboxes; the recommended ones start checked |
| `codello decide revise <id> "<question>" --options "A\|B"` | Replace a decision you posted, keeping its id and place |
| `codello decide revise <id> --file -` | The same, with one JSON entry read from stdin |
| `codello decide withdraw <id>...` | Remove decisions you posted; all or none |
| `codello decide list [--json]` | List this session's decisions that have not reached you, with their ids |
| `codello decide list --all [--json]` | List every live session's decisions that have not reached their agent; read-only |
| `codello decide list --session <id> [--json]` | The same for one session, by id or prefix |
| `codello decide show <id> [--json]` | Print one decision in full, from any session, by id or prefix; read-only |
| `codello decide present <id>...` | Show other sessions' open decisions in this session's chat, in the order given; all or none |
| `codello decide present --file -` | The same, from a JSON list whose items are an id or `{"decisionId", "note"}` |
| `codello decide present --clear` | Stop showing other sessions' decisions here |

## Related

`codello ask` asks a question and waits for the answer. `/codello:waiting` declares that the session needs the user once your turn ends.
