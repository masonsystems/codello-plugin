---
name: docs
description: "Answer questions about how to use Codello from the official documentation at https://codello.app/docs — install, login, hooks, push notifications, responding from your phone, multi-device, end-to-end encryption and device pairing, scheduled sessions, the CLI command list, VS Code/Cursor integration, the Docker sandbox, keyboard shortcuts, mobile features, configuration, and troubleshooting. Triggers: any \"how do I … with Codello\", \"what does codello <command> do\", \"why am I not getting notifications\", \"does Codello support …\", or a request to search/look up the Codello docs. Read this BEFORE answering a Codello usage question from memory — the product changes often and memory is stale."
allowed-tools: Bash
---

# Codello docs

Answer Codello usage questions from the published docs, not from memory. The docs are one
HTML page at https://codello.app/docs with no search API, so this skill ships a helper that
fetches the live page and turns it into greppable text:

```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/docs/scripts/docs.sh"
"$D" index                     # every section with its #anchor
"$D" search <term> [term...]   # case-insensitive grep, terms ORed, with context
"$D" section <anchor>          # one whole section, e.g. `section e2e-encryption`
"$D" all                       # the full page as text (~14 KB)
```

Every call re-fetches the page (it's small), so you always read what's deployed.

## How to answer

1. **Search first, then read the section.** `search` finds the line; `section <anchor>` gives
   the surrounding steps and code blocks you need to answer correctly. Quote commands
   exactly as the docs print them.
2. **Link the section.** Each `## Heading   [#anchor]` maps to
   `https://codello.app/docs#<anchor>` — end the answer with that link so the user can
   read more.
3. **Not in the docs? Say so, then use the next source.** `search` prints
   `(no match for: …)` rather than failing. In that case, in order:
   - `codello --help` and `codello <command> --help` — the installed CLI's own reference,
     which covers commands the page doesn't yet (for example `snooze`, `rename`, `tail`,
     `copy`, `viewers`).
   - The other skills and commands in this plugin: the `codello:cli` skill (sessions, ids, triage),
     `/codello:spawn`, `/codello:schedule`, `/codello:copy`, `/codello:handoff`,
     `/codello:resume`, `/codello:compact`.
   - Tell the user it isn't documented. Don't invent a flag or a setting.
4. **Diagnose with the docs' own commands.** For "it isn't working" questions the
   Troubleshooting section names the checks (`codello status`, `codello hook check`,
   `codello repair`, `codello logs search`). Run the read-only ones when you're on the
   user's machine and report what they show, instead of listing them for the user to run.

## Hazards

- The page is the **user-facing** manual. It doesn't cover internals; for session ids,
  transcripts, or "what is session X doing", use the `codello:cli` skill instead.
- `codello stop` appears in the CLI table. Never run it to fix a problem — it kills every
  session on the machine and cuts the user off from their phone. `codello restart` keeps
  sessions.
- `curl` must reach codello.app. If the fetch fails (offline, sandbox), fall back to
  `codello --help` and say the live docs were unreachable.
- Set `CODELLO_DOCS_URL` to point the helper at a staging or local Worker.
