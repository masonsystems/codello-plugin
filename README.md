# Codello plugin for Claude Code

Companion slash commands for [Codello](https://codello.app), the natural-language front
door to the `codello` CLI:

- **`codello:cli` skill** (no slash command — loads itself when relevant) — teaches an
  agent to work the `codello` CLI: list what's running on this machine, map a transcript
  id back to the session that wrote it, read what a session said without attaching, and
  see what's waiting on you.
- **`codello:docs` skill** (no slash command — loads itself when relevant) — answers
  "how do I … with Codello" questions from the live documentation at
  [codello.app/docs](https://codello.app/docs): it fetches the page, searches it, and
  quotes the matching section with a link, falling back to `codello --help` for anything
  the page doesn't cover yet.
- **`codello:secrets` skill** (no slash command — loads itself when relevant) — asks you for
  an API key, token, or password on whatever device you are holding, in a masked field, so
  the value never enters the transcript, the scrollback, or the logs.
- **`/codello:spawn`** — start fresh, titled sessions *now*, one per task, in any project
  directory — driveable from your phone the moment they start.
- **`/codello:schedule`** — schedule a fresh, pre-seeded Claude Code session to fire later
  on your own dev machine.
- **`/codello:handoff`** · **`/codello:resume`** — write a handoff another agent (or a
  fresh session) can pick up, and resume from one.
- **`/codello:compact`** — reset a *live* Codello session's context in place: like
  `/compact`, but a real process reset — hot-swap the `claude` process, reseeded from a fresh
  handoff, without a reconnect.
- **`/codello:fresh`** · **`/codello:continue`** — the no-handoff version of the same swap,
  for a session that's merely too big to keep paying for: `fresh` replaces the agent and tells
  the replacement which conversation it took over from; `continue` finds that conversation
  after a `/clear` and picks it up from its two ends.
- **`/codello:copy`** — put formatted content on the clipboard of the phone or browser
  viewing the session, so a paste into Gmail/Docs/Slack keeps bold, bullets, tables, and
  monospace.
- **`codello:quit` skill** (also `/codello:quit`) — "reply and quit", "ship it and quit":
  when the task succeeds, the agent ends its own session at the end of the turn, so you never
  have to go back to it. On any failure it leaves the session open and reports instead.
- **`codello:done` skill** (also `/codello:done`) — the agent reports what the task ended as,
  so the session's row shows a green check or a red ✕ and you learn the outcome without
  opening it. It runs only when nothing is left for you in that session.

## Prerequisites

The Codello CLI must be installed and running (the plugin shells out to it):

```bash
curl -fsSL https://codello.app/install.sh | bash
codello login
codello start
```

## Install

In Claude Code:

```
/plugin marketplace add masonsystems/codello-plugin
/plugin install codello@codello-marketplace
```

## Upgrading from codetogo

CodeToGo is now Codello. The plugin, its namespace, and the marketplace are renamed in one step, and the old `codetogo` names are gone. Run these four commands in Claude Code:

```
/plugin uninstall codetogo@codetogo-marketplace
/plugin marketplace remove codetogo-marketplace
/plugin marketplace add masonsystems/codello-plugin
/plugin install codello@codello-marketplace
```

Install a Codello CLI new enough to spawn `/codello:*`. The server relaunches the agent with `claude /codello:resume <path>` and `claude /codello:continue <id>` when `/codello:compact` or `/codello:fresh` swaps it in place, so on an older CLI the replacement is told to run a command it no longer has. Run `codello upgrade`, then `codello restart`.

Edit any scheduled prompt of yours that names a `/codetogo:` command. The old namespace no longer resolves, so a scheduled session that asks for `/codetogo:handoff` gets nothing.

The CLI installs both a `codello` and a `codetogo` binary during its own deprecation window, and this plugin calls `codello`. Its state still lives in `~/.codetogo`, so your login, snapshots, and uploads survive the rename untouched.

## Working the CLI (`codello:cli` skill)

A skill, not a command — it loads on its own whenever a task involves a session on this
machine, a session id, "which agent wrote this", or a `codello` command. It exists to
stop agents burning turns on questions the CLI answers in one call:

```bash
codello sessions --json     # every live session: state, title, cwd, and BOTH ids
```

If it doesn't seem to load on its own, invoke it once by hand (`Skill: codello:cli`) —
Claude Code budgets the always-on skill listing and ranks it by recent use, so on a machine
with a lot of skills installed a brand-new one can start out ranked too low to be offered.
One use is enough to promote it.

The load-bearing thing it teaches is that each session has **two** unrelated uuids — the
PTY/Codello `id` and the `agentSessionId` naming the Claude/Codex transcript on disk —
that are not interchangeable, and that neither command falls back to the other. With the
mapping in hand, "which session produced this commit?" is a `jq` one-liner over
`agentSessionId` instead of a grep across `~/.claude/projects`. It also covers reading a
session's last messages without attaching to it (`codello tail`), triaging what's
`waiting-on-you` / `blocked-on-you`, resolving an id from a *dead* session out of the
resume snapshots, and the read-only-vs-intrusive line (`connect` attaches to a live PTY;
`stop` kills every session on the machine).

## Asking how to use Codello (`codello:docs` skill)

A skill, not a command — it loads when you ask a usage question ("how do I pair my phone
for end-to-end encryption?", "why am I not getting push notifications?", "what does
`codello spawn` do?"). It answers from the published docs rather than the model's memory:
a bundled helper fetches https://codello.app/docs, greps it, and the agent quotes the
matching section and links it (`https://codello.app/docs#<section>`). Anything the page
doesn't cover falls back to `codello --help` and the plugin's other skills, and the agent
says plainly when something isn't documented instead of guessing. Same ranking caveat as
`codello:cli`: invoke it once by hand (`Skill: codello:docs`) if it doesn't load on its own.

## Spawn

```
/codello:spawn fix the flaky auth test
/codello:spawn triage the support inbox in ~/src/support-bot, and bump deps in ~/src/site
```

One fresh `claude "<prompt>"` session per task — titled for the task, started in that
task's own project directory, detached, and live in your Codello session list immediately, so you can watch, approve, and steer each one from
your phone (assuming `codello` is connected to the cloud — the CLI warns at spawn time if
it isn't). Reach for it (instead of in-session team agents/subagents) when you'll drive
the new sessions yourself, or the tasks aren't part of the current session's work — e.g.
one planning session fanning work out across several projects. Same ground rules as
schedule: each prompt is written self-contained (the new session has no memory of the chat
that spawned it), and each directory should be a trusted Claude project.

## Schedule

```
/codello:schedule review the open PRs every weekday at 9am
/codello:schedule list
/codello:schedule remove nightly-review
```

A scheduled run is a **fresh** `claude "<prompt>"` in the chosen directory — it inherits
that dir's files/tools/creds but has **no memory** of the chat that created it, so the
prompt is always written to be self-contained. The directory must be a trusted Claude
project (open Claude there once and accept the trust dialog), and `codello` must be
running for the schedule to fire.

## Quit when done

Tell an agent to do something *and quit* — "send the reply and quit", "close COD-123 and quit",
"ship it, then close this session" — and, if the task fully succeeds, it runs `codello quit`
as its last tool call and ends the turn. The session closes after the final reply is written:
it leaves every list with no red dot and no push, sits in the recently-closed list (Cmd-Shift-T
brings it back intact for 10 seconds, a reopen `--resume`s it after that), and the transcript
stays readable with `codello history`.

The quit is conditional on success. A failed test, a PR that won't merge, a bounced email, a
question the agent needs answered — any of these and the session stays open with a normal report.

## Report the outcome

An agent that finishes with nothing left for you runs `codello done`, or `codello done --failed`
when the task cannot be completed as asked. The session's row shows a green check or a red ✕ with
a one-line summary, a failure sends you a push, and a done session closes itself after 24 hours
unless you open it or type in it. The same rule as quit applies: an open pull request, a follow-up,
a question, or a decision means the session ends with an ordinary report instead.

## Handoff, resume & compact

Transfer context across a boundary — a new agent, a new session, or a fresh process under
the *same* live session:

```
/codello:handoff            # write .claude/tmp/HANDOFF.md (add `quick` for the essentials)
/codello:resume [path]      # pick up from a handoff (default: .claude/tmp/HANDOFF.md)
/codello:compact [path]     # reset THIS live Codello session in place, reseeded from a handoff
/codello:fresh              # same swap, no handoff — the replacement reads this transcript
/codello:continue [id]      # after a /clear: find and pick up the conversation that ran here
```

`handoff` and `resume` are tool-agnostic — the handoff is a plain `HANDOFF.md` any AI coding
agent can read, kept in the gitignored `.claude/tmp/` and treated as a one-shot baton
(`resume` deletes a default handoff the moment it reads it).

`compact` is Codello-native: inside a Codello-owned session (a `codello claude` session, the
web "new session" button, or a scheduled run) it writes a handoff and arms an **in-place
process swap**. At the next idle boundary the old `claude` is killed and
`claude /codello:resume <path>` takes its place under the same PTY — same session id,
viewers, phone entry, terminal pane, and scrollback. It's `/compact`, but the reset is a real
new process (a true near-zero context reset) and the client sees no reconnect, only new
output. Reach for it when the context is *polluted*, not merely long.

Both `handoff` and `compact` take a **background inventory** first: every `Monitor` and
background `Bash` task the session started and never saw finish, read out of the transcript
with its command intact. The swap kills the outgoing `claude` with `killProcessTree`, so a
monitor watching a deploy or a poll loop waiting on CI dies with it, and the fresh process
has no way to learn it existed. The inventory goes into the handoff under
`## Background Tasks` with a keep-or-drop call per task, and `resume` re-arms the keepers
before it touches the work. Claude Code's own `/compact` leaves those processes running but
stops delivering their notifications, which looks identical to nothing having happened.

`fresh` is the same swap with the handoff step deleted, for when the context is merely
*expensive*: a session so large its cache has expired, where the work is fine and the only
problem is the price of the next turn. The dying agent writes nothing — it arms the swap and
stops — and the replacement is handed the id of the conversation it took over from, which it
reads at fresh-context prices. A handoff is better context than a transcript, but writing one
costs a turn in the most expensive session you have; `fresh` is the trade for when that turn
is the thing you're avoiding.

`continue` is the same pickup, for when you've *already* cleared. Claude Code starts a brand-new
conversation and a brand-new transcript on `/clear`, with nothing in either file pointing back
at the one it replaced — the shared Codello session is the only surviving link, so the agent
can't find the work on its own. `/codello:continue` asks Codello which conversations have run
here, then reads the chosen one's opening ask and last turns. Run it bare and it picks; pass an
id and it takes that one. It never reloads the whole conversation — that's `claude --resume`,
and it's the cost you were escaping.

## Copy

```
/codello:copy                                   # copy what we just wrote
/codello:copy the release notes, as an email
```

The agent runs on your dev machine, but the clipboard it writes is the one on the device
**viewing the session**. The agent writes plain markdown; the CLI converts it to email-ready
HTML (Gmail's Arial 14px, real bullets and tables, monospace for commands), sends it down the
session's own encrypted pipe, and a chip appears over your terminal. One tap on **Copy** puts
it on your clipboard — both a rich and a plain flavor, so a paste into Gmail, Docs, or Slack
keeps the formatting while a paste into a plain editor still reads.

Headings, bold/italic, inline and fenced code, nested bullet and numbered lists, pipe tables
with column alignment, links, and horizontal rules all carry over. Converting in the CLI
rather than the agent is what makes this one turn instead of two.

The tap is required: browsers only allow a clipboard write inside a real user gesture. The
chip waits until you take it, so this works fine when your phone is in your pocket. Nothing
viewing the session means nowhere for the chip to land — open it on your phone or in a
browser first.
