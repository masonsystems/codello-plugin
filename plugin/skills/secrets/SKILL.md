---
name: secrets
description: "Ask the user for an API key, token, password, or any other credential you need to finish a task — `codello secret request` — and use it again later in the session with `codello secret get`. Use this INSTEAD of telling the user to paste a key into the chat, put one in a file, or edit .env themselves: they are usually on a phone and cannot edit files, and a key pasted into the conversation is recorded permanently in the transcript, the terminal scrollback, and the logs. Triggers: you encounter a missing ANTHROPIC_API_KEY / OPENAI_API_KEY / GITHUB_TOKEN / AWS credential / database password / .env value, a command fails with 401 or 403 or \"not authenticated\", a setup step needs a credential you do not have, or you are about to write \"please add your key to\" anything."
---

# Ask the user for a secret

When you need a credential to continue, ask for it once, by name. The user gets a masked field on whatever device they are holding and pastes the value. The Codello server keeps it in memory for the rest of this session, so you can use it again in a later step, after a compact, or in the next turn without asking again.

## Check what this session already holds

```bash
codello secret list
```

This prints the names this session holds, one per line, and never the values. If the name you need is there, skip the request and use it.

## Ask for it

```bash
codello secret request GITHUB_TOKEN --reason "Opening the release PR"
```

The name is what you use to get the value back later, and the user sees it above the field. Use a short identifier such as `GITHUB_TOKEN` or `STRIPE_TEST_KEY`. `--reason` says what it is for.

The command blocks until the user answers. It writes an instruction to stderr, and the path of a 0600 file to stdout as its only line:

```
[codetogo] Got GITHUB_TOKEN. Put the value where it belongs with shell substitution, …
/Users/eric/.codetogo/uploads/<session>/secrets/<id>-GITHUB_TOKEN
```

You do not need the file. Get the value from the session instead.

If this session already holds the name, the command returns at once without asking the user, and says so on stderr.

## Use it

Get the value with shell substitution, each time you need it:

```bash
GITHUB_TOKEN="$(codello secret get GITHUB_TOKEN)" gh pr create --fill
curl -H "Authorization: Bearer $(codello secret get STRIPE_TEST_KEY)" https://api.stripe.com/v1/balance
```

`codello secret get` writes the raw value to stdout and nothing else. It exits 1 when this session does not hold the name, and refuses with exit 2 when stdout is a terminal, so run it only inside `$(…)`.

## When the value is wrong

If the service rejects the secret as wrong, revoked, or expired, ask again with `--refresh`. That asks the user even though the session holds the name, and replaces the held value when they answer:

```bash
codello secret request GITHUB_TOKEN --refresh --reason "The token was rejected with 401; it may have expired"
```

Say in `--reason` why you are asking again.

## Rules

- **Never print the value.** No bare `codello secret get`, no `cat` of the file, no echoing it back to confirm, no putting it in a commit message or a log line. Everything you print is recorded where the value must not be.
- **Use shell substitution, never your own eyes.** `$(codello secret get NAME)` moves the value without it entering the conversation. Opening the file with a tool puts the credential in your context, which is exactly what this avoids.
- **Do not copy it into a file.** Not `.env`, not a config file, not a script, unless the user asks you to. The session holds it, so get it each time instead. A copy on disk outlives the session and is one more place the user has to scrub.
- **Check `codello secret list` before you ask.** Asking for a key this session already holds wastes the user's attention.
- **Say what it is for.** `--reason` is shown above the field. A request to paste a credential with no stated purpose is one the user should refuse, so give them what they need to say yes.
- **Always name it.** An unnamed request still works, but the session does not keep the value, so you can use it only once, from the file.

## When the user says no

Every ending is explicit and exits non-zero, so you can branch on it:

| Ending | What it means | What to do |
|--------|---------------|------------|
| `Declined` | The user chose not to provide it | Stop asking. Say what you cannot do without it. |
| `Timed out` | Nobody answered within the window (default 10 minutes, maximum 30) | Say you are blocked and what you need; do not loop. |
| `The session closed` | The session went away while waiting | Nothing to do. |

Do not retry a decline. The user answered. A declined `--refresh` leaves the old value in place.

## Commands and options

| Command | Purpose |
|---------|---------|
| `codello secret list` | Names this session holds, one per line |
| `codello secret request NAME` | Ask the user, or return at once if the session holds `NAME` |
| `codello secret get NAME` | The value, for `$(…)` only |

| `secret request` flag | Purpose |
|------|---------|
| `--reason <text>` | One line on what the secret is for, shown above the field |
| `--refresh` | Ask the user even if the session holds the name, and replace it |
| `--timeout <seconds>` | How long to wait (default 600, capped at 1800) |
| `--session <id>` | Target another session; defaults to the one you are running in. `get` and `list` take it too |

## How long a secret lasts

The server holds each named secret in memory until the session closes. The server never writes it to disk and never sends it to the cloud. A server restart loses it; when `codello secret get` exits 1 for a name you used before, ask again. The file the request prints is deleted after five minutes whatever you do.

An older Codello server keeps nothing: `codello secret list` prints a note to run `codello upgrade`, and `codello secret get` exits 1. On such a server, read the value from the printed path instead, with `"$(cat "$SECRET_PATH")"`, where `SECRET_PATH="$(codello secret request NAME --reason "…" | tail -1)"`.

## When not to use this

- **The value is already available.** Check `codello secret list`, the environment, and the existing config first.
- **You do not actually need it.** If the task can be finished without the credential, finish it.
- **It is not a secret.** A path, a URL, a project name, or any other non-sensitive answer is an ordinary question. Ask it in the conversation.
