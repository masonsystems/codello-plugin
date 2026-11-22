---
name: secrets
description: "Get a credential from the user with `codello secret request` and reuse it with `codello secret get`, instead of asking them to paste a key into chat or edit .env. Use when an API key, token, or password is missing, or a command fails with 401, 403, or \"not authenticated\"."
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
codello secret request "GitHub token" --reason "Opening the release PR"
```

The name is what the user reads above the field and in the push, and what you use to get the value back later. Name it in plain words, the way the user would say it, such as `"GitHub token"` or `"Stripe test key"`, and quote it, because a name with spaces is one argument. Never use an environment-variable name such as `GITHUB_TOKEN`: the user reads it as configuration, not as the thing you asked for, and the command warns on stderr when you do. `codello secret get` matches names regardless of case, spaces, underscores, and hyphens, so `"github token"` finds `"GitHub token"`. `--reason` says what it is for.

If the user has to create or regenerate the credential first, put the creation page in `--reason` with the name and scopes already filled in, for example `https://github.com/settings/tokens/new?scopes=read:org&description=release-bot`. Lead with that link, not with steps for editing an existing credential, which can't be pre-filled. Write the full `https://` address: the reason is Markdown, so a link such as `[Create the key](https://dashboard.stripe.com/apikeys/create)` opens with one tap on the user's phone, and `codello secret request` warns on stderr when the reason holds no `https://` link.

The command blocks until the user answers. It writes an instruction to stderr, and the path of a 0600 file to stdout as its only line:

```
[codello] Got GitHub token. Put the value where it belongs with shell substitution, …
~/.codello/uploads/<session>/secrets/<id>-GitHub_token
```

You do not need the file. Get the value from the session instead.

If this session already holds the name, the command returns at once without asking the user, and says so on stderr.

## Ask for several at once

When the task needs more than one credential, ask for all of them in one command. The user gets one prompt with a field for each name, instead of one prompt after another:

```bash
codello secret request "Stripe key" "Webhook secret" --reason "Testing the billing webhook"
```

You can name up to 10. Names this session already holds are answered at once and get no field. Stdout has one line for each name that arrived, the name and its path separated by a tab, so split each line on the tab, not on spaces:

```
Stripe key	~/.codello/uploads/<session>/secrets/<id>-Stripe_key
Webhook secret	~/.codello/uploads/<session>/secrets/<id>-Webhook_secret
```

The user can send some fields and leave the rest. The command waits until every name is sent, declined, or timed out, then exits 0 when all of them arrived, 3 when any is still open on the user's devices, and 1 otherwise. Read each one with `"$(codello secret get "NAME")"`. Before you go on after a non-zero exit, run `codello secret list` to see which names you have.

## Use it

Get the value with shell substitution, each time you need it:

```bash
GITHUB_TOKEN="$(codello secret get "GitHub token")" gh pr create --fill
curl -H "Authorization: Bearer $(codello secret get "Stripe test key")" https://api.stripe.com/v1/balance
```

`codello secret get` writes the raw value to stdout and nothing else. It exits 1 when this session does not hold the name. Run it only inside `$(…)`.

It refuses with exit 2 when stdout is a terminal, but that protects only a person typing at one. Your Bash tool runs commands with stdout on a pipe, so a bare `codello secret get NAME` from you is not refused: it prints the value into the transcript. Nothing stops that except the rule below.

## When the value is wrong

Check the value's shape before you use it, without printing it. A pasted label or name instead of the key is a common mistake, and a shape check catches it before a confusing API error does:

```bash
v="$(codello secret get "GitHub token")"; case "$v" in ghp_*|github_pat_*) echo "shape ok, ${#v} chars" ;; *) echo "unexpected shape, ${#v} chars" ;; esac
```

Check the length, any known prefix, and that it has no spaces. If the shape is wrong, ask again with `--refresh` and say in `--reason` what looked wrong.

If the service rejects the secret as wrong, revoked, or expired, ask again with `--refresh`. That asks the user even though the session holds the name, and replaces the held value when they answer:

```bash
codello secret request "GitHub token" --refresh --reason "The token was rejected with 401; it may have expired"
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
| `Timed out ..., but the request is still open` (exit 3) | Nobody answered within the window (default 10 minutes, maximum 30). The request stays on the user's devices, and the CLI sets the session to waiting unless it runs inside a subagent | End your turn and do not ask again. When the user sends it (or each name still open), Codello types a line into the session that says how to read it, usually `"$(codello secret get NAME)"`; continue from there. If the output says to set waiting yourself, run the command it gives first. If Codello restarts before the user answers, the request is gone; ask again. |
| `Timed out` (exit 1) | Nobody answered, and an older Codello server ended the request | Say you are blocked and what you need; do not loop. |
| `The session closed` | The session went away while waiting | Nothing to do. |

Do not retry a decline. The user answered. A declined `--refresh` leaves the old value in place.

## Commands and options

| Command | Purpose |
|---------|---------|
| `codello secret list` | Names this session holds, one per line |
| `codello secret request "NAME"` | Ask the user, or return at once if the session holds `NAME`. Name it in plain words, quoted |
| `codello secret request "NAME 1" "NAME 2" …` | Ask for up to 10 names in one prompt |
| `codello secret get "NAME"` | The value, for `$(…)` only. Matches regardless of case, spaces, and underscores |

| `secret request` flag | Purpose |
|------|---------|
| `--reason <text>` | What the secret is for, with an `https://` link to the page that creates it, in Markdown, shown above the field |
| `--refresh` | Ask the user even if the session holds the name, and replace it |
| `--timeout <seconds>` | How long to wait (default 600, capped at 1800) |
| `--session <id>` | Target another session; defaults to the one you are running in. `get` and `list` take it too |

## How long a secret lasts

The server holds each named secret in memory until the session closes. The server never writes it to disk and never sends it to the cloud. It survives `codello restart` and `codello upgrade`, which hand it to the replacement server. A Codello stop, crash, or reboot loses it; when `codello secret get` exits 1 for a name you used before, ask again. The file the request prints is deleted after five minutes whatever you do.

An older Codello server keeps nothing: `codello secret list` prints a note to run `codello upgrade`, and `codello secret get` exits 1. On such a server, read the value from the printed path instead, with `"$(cat "$SECRET_PATH")"`, where `SECRET_PATH="$(codello secret request NAME --reason "…" | tail -1)"`.

## When not to use this

- **The value is already available.** Check `codello secret list`, the environment, and the existing config first.
- **You do not actually need it.** If the task can be finished without the credential, finish it.
- **It is not a secret.** A path, a URL, a project name, or any other non-sensitive answer is an ordinary question. Ask it in the conversation.
