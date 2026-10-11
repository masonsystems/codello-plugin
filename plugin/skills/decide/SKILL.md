---
name: decide
description: "Run `codello decide \"<paragraph>\" --options \"Recommended|Other\"` once per decision that only the user can make, then `codello session-status set waiting`. The user answers on their phone, and every answer comes back to you as one prompt. Never list the decisions in your reply. Needs a `codello` CLI with the `decide` command."
---

# Put a decision to the user

`codello decide` posts one decision to the user's phone and browser and returns at once. You keep working or end your turn. The user answers each decision with a tap or in their own words, and the answers come back to you later as one prompt:

```
Answers to your decisions:
1. The cache key ignores the locale, so French users get English pages. Recommend a… → Add the locale
2. Two unrelated fixes are on this branch. Recommend shipping them in one PR. → (dismissed)
```

The prompt arrives when the user has answered or dismissed every open decision, when they tap Send answers to send what they have answered so far, or ahead of the next message they type.

## When to use it

Use it for a decision only the user can make that you would otherwise write into your reply and leave for them to answer in prose. Use `codello ask` instead when you must have the answer before you can do anything else in this turn; it waits for the answer and prints it.

## Write each decision so the user can act on it cold

The user reads each decision alone, on a phone, possibly hours later, without your reply or the code in front of them. Each call is one decision, and its paragraph says:

1. What has to be decided, naming the thing: the file, the PR, the flag, the service.
2. Why it matters: what goes wrong, or what it costs, either way.
3. What you recommend.

Give 1 to 3 options with `--options`, separated by `|`. Put your recommendation first; the card marks the first option Recommended. Keep each option a few words. Leave `--options` off when the answer is open-ended. The user can always type their own answer, or dismiss the decision.

```bash
codello decide "The integration tests run against SQLite, but production uses Postgres, so the JSON column queries in reports.ts are never tested. Recommend switching the test database to Postgres; it adds about 20 seconds to a run." --options "Switch to Postgres|Keep SQLite"
codello decide "The release flag beta_ui now gates the whole app, not the beta UI. Recommend renaming it to new_app before more code reads it." --options "Rename it|Keep beta_ui"
```

## Then declare the wait, and keep the decisions out of your reply

After the last `codello decide` in a turn, run `codello session-status set waiting -m "<n> decisions are waiting on you"` before your final reply (the `waiting` skill). The decisions are already on the user's phone. Never repeat or list them in your reply: the user would read each one twice and could answer the copy that never reaches you.

## Reading the result

Run the command with `dangerouslyDisableSandbox: true`. The CLI talks to the local server, which a sandboxed command cannot reach.

- Exit 0 means the host holds the decision. stdout is the decision's id and nothing else.
- Exit 1 means the decision was not posted, and stderr says why: not in a Codello session, Codello not running, more than 3 options, or a Codello server too old to take decisions. Put that decision in your reply instead, and say what stopped the command.

## Options

| Command | Purpose |
|------|---------|
| `codello decide "<paragraph>"` | Post a decision the user answers in their own words |
| `codello decide "<paragraph>" --options "A\|B\|C"` | Offer up to 3 options; the first is your recommendation |

## Related

`codello ask` asks a question and waits for the answer. `/codello:waiting` declares that the session needs the user once your turn ends.
