---
name: decide
description: "Post every decision only the user can make in one `codello decide --file -` call, a JSON list read from stdin, with any text the user approves in full in each decision's `details`; then `codello session-status set waiting`. The user answers on their phone, and every answer comes back to you as one prompt. Never list the decisions in your reply, and never write \"see the reply\" in a decision. Needs a `codello` CLI with the `decide` command."
---

# Put decisions to the user

`codello decide` posts decisions to the user's phone and browser and returns at once. You keep working or end your turn. The user answers each decision with a tap or in their own words, and the answers come back to you later as one prompt:

```
Answers to your decisions:
1. The cache key ignores the locale, so French users get English pages. Recommend a… → Add the locale
2. Two unrelated fixes are on this branch. Recommend shipping them in one PR. → (dismissed)
```

The prompt arrives when the user has answered or dismissed every open decision, when they tap Send answers to send what they have answered so far, or ahead of the next message they type.

## When to use it

Use it for a decision only the user can make that you would otherwise write into your reply and leave for them to answer in prose. Use `codello ask` instead when you must have the answer before you can do anything else in this turn; it waits for the answer and prints it.

## Write each decision so the user can act on it cold

The user reads each decision alone, on a phone, possibly hours later, without your reply or the code in front of them. Each decision's `question` is one paragraph that says:

1. What has to be decided, naming the thing: the file, the PR, the flag, the service.
2. Why it matters: what goes wrong, or what it costs, either way.
3. What you recommend.

Give 1 to 3 `options`. Put your recommendation first; the card marks the first option Recommended. Leave `options` out when the answer is open-ended. The user can always type their own answer, or skip the decision.

Write each option as `Label: one-line description`, so a tap on it makes sense without the paragraph above:

- The label names the choice in a few words. Never a bare letter or number such as `A` or `Option 2`, which means nothing on the card.
- The description says what that choice does or costs, in one line. Keep the whole option under 120 characters, which every Codello version shows in full.
- Never write `(recommended)` in an option. The card already marks the first option Recommended, and the words would show twice.

## Put the text being approved in `details`

When a decision approves text (an email, a ticket comment, a PR description, a message), put that text in full in the decision's `details`, as Markdown: recipients, subject, and body. The card shows it behind a Details toggle under the question. Never write "see the reply", "the draft above", or "the note I drafted earlier": the user answers from the card, and your reply may be hours of scrolling away. `details` holds up to 16 KB.

## Post every decision in one call

Post all of a turn's decisions in one call, with a JSON list on stdin. Each entry has a `question`, and optionally `options` (a list of 1 to 3 strings) and `details`. The CLI checks every entry before it posts anything, so one bad entry posts none of them; fix it and run the call again. A quoted heredoc keeps the shell from touching the text:

```bash
codello decide --file - <<'JSON'
[
  {
    "question": "The integration tests run against SQLite, but production uses Postgres, so the JSON column queries in reports.ts are never tested. Recommend switching the test database to Postgres; it adds about 20 seconds to a run.",
    "options": ["Switch to Postgres: tests match production, runs take 20 seconds longer", "Keep SQLite: fast runs, JSON queries stay untested"]
  },
  {
    "question": "Dana asked when the export fix ships. Recommend sending this reply, which promises Thursday.",
    "options": ["Send it: Dana gets the date today", "Hold it: no promise until the fix merges"],
    "details": "**To:** dana@example.com\n\n**Subject:** Re: Export fix\n\nHi Dana,\n\nThe export fix ships Thursday."
  }
]
JSON
```

A lone decision can also go on the command line: `codello decide "<paragraph>" --options "A|B" --details "<markdown>"`.

## Then declare the wait, and keep the decisions out of your reply

After the `codello decide` call, run `codello session-status set waiting -m "<n> decisions are waiting on you"` before your final reply (the `waiting` skill). The decisions are already on the user's phone. Never repeat or list them in your reply: the user would read each one twice and could answer the copy that never reaches you.

## Reading the result

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server, which a sandboxed command cannot reach.

- Exit 0 means the host holds every decision. stdout is one decision id per line, in the order you posted them, and nothing else.
- Exit 1 means nothing was posted, and stderr says why: a bad entry (each one is named), not in a Codello session, Codello not running, or a Codello server too old to take decisions. Fix a bad entry and post again. If the CLI rejects `--file` or `--details` as an unknown option, it is too old for them: post one `codello decide "<paragraph>" --options "..."` per decision instead, and put any text being approved in that paragraph. Otherwise put the decisions in your reply, and say what stopped the command.

## Options

| Command | Purpose |
|------|---------|
| `codello decide --file -` | Post a JSON list of decisions read from stdin, in one call |
| `codello decide --file <path>` | The same, read from a file |
| `codello decide "<paragraph>"` | Post one decision the user answers in their own words |
| `codello decide "<paragraph>" --options "A\|B\|C"` | Offer up to 3 options; the first is your recommendation |
| `codello decide "<paragraph>" --details "<markdown>"` | Show the text being approved behind a Details toggle |

## Related

`codello ask` asks a question and waits for the answer. `/codello:waiting` declares that the session needs the user once your turn ends.
