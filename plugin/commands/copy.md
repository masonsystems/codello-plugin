---
description: Copy content to the clipboard of the phone or browser viewing this Codello session, as rich text — bold, bullets, tables, and monospace survive a paste into Gmail, Docs, or Slack. Use when the user wants to paste something from this session on their device.
argument-hint: <content to copy> (or omit to copy what was just discussed)
allowed-tools: Bash
---

Put `$ARGUMENTS` on the clipboard of whatever device is **viewing this session** — the
user's phone, or a browser tab at https://codello.app — formatted as rich text so a paste
into Gmail/Docs/Slack keeps the formatting instead of arriving as a wall of asterisks.

This is the remote twin of a local "copy to clipboard": the agent runs on the dev machine,
but the clipboard that gets written is the one on the device the user is holding. The user
taps **Copy** on the chip that appears over their terminal; that tap is what writes the
clipboard (browsers only allow a clipboard write inside a real user gesture).

If `$ARGUMENTS` is empty, copy the thing just produced or discussed — a draft email, a
summary, a table, a command. Ask only if that's genuinely ambiguous.

**Write plain markdown, not HTML.** `codello copy --md` converts it to Gmail-safe HTML for
you — inlining every style, matching Gmail's own font, and using a styled span for monospace
because Gmail strips `<code>`. Getting those rules right by hand costs you ~2.4x the tokens
and gets them subtly wrong in ways that only show up after a paste.

**Do the whole thing in ONE Bash tool call** — the heredoc below writes the file, pushes it,
and cleans up as several shell statements inside a single call, exactly as shown (it does
*not* need to collapse onto one physical line). Don't use the Write tool: that forces a
second turn for no benefit, since the heredoc already preserves the bytes exactly.

## Write and push it — one call

```bash
f=$(mktemp /tmp/codello-copy-XXXXXX)
cat > "$f" <<'CTG_MD'
…markdown body…
CTG_MD
codello copy --md "$f" --source "<short label>"; rc=$?; rm -f "$f"; exit $rc
```

Four things in that snippet are load-bearing:

- **The heredoc delimiter is quoted** (`<<'CTG_MD'`, not `<<CTG_MD`). Quoting disables all
  shell expansion, so the body's bytes arrive verbatim — apostrophes, em-dashes, smart
  quotes, backticks, `$HOME`, and emoji all survive. An *unquoted* delimiter would expand
  `$…` and backticks and corrupt the content. This is why no escaping or `printf` juggling
  is needed, and why inline code in backticks is safe: put the markdown in raw.
- **`mktemp`, not a fixed path.** Two concurrent sessions running this would otherwise
  clobber each other's file.
- **No `.md` suffix on the template.** BSD `mktemp` (the macOS default) only substitutes the
  `X`s when they're at the very END of the template — `…-XXXXXX.md` yields the *literal*
  filename `codello-copy-XXXXXX.md`, silently losing the randomization above. The CLI
  doesn't care about the extension, so leave it off.
- **`rm -f` runs after the push, and `rc` preserves the exit code** so a failed push still
  fails the command instead of being masked by the successful `rm`.

The delimiter only ends the heredoc when it's alone on a line — `CTG_MD` inside a sentence is
ordinary content. In the rare case the body genuinely needs a line that is exactly `CTG_MD`,
pick a different delimiter.

Write the markdown body only — no wrapper, no outer ``` fence around the whole thing (fenced
code blocks *inside* the body are fine and render as code).

## What the markdown supports

Everything an email or a summary needs, and each one becomes real formatting:

| Markdown | Result |
|:---------|:-------|
| `# H1` … `###### H6` | Headings, descending sizes |
| `**bold**`, `*italic*` | `<b>`, `<i>` |
| `` `code` `` | Monospace span |
| ` ```lang ` fences | Shaded monospace block, indentation preserved |
| `- item` / `1. item` | Bullet / numbered lists, nested by indentation |
| `\| a \| b \|` + `\|---\|` | A real table with borders and column alignment |
| `[label](https://…)` | A link |
| `---` | A horizontal rule |

A single newline inside a paragraph becomes a line break, so your line structure is kept.
Only `https`, `http`, `mailto`, and `tel` links are honored — anything else keeps the label
and drops the link, because a relative URL has no meaning once pasted elsewhere.

Block quotes, reference-style links, and raw inline HTML are **not** converted — they arrive
as literal text. If the content genuinely needs markup outside this list, hand-author the
HTML and use `--html <file>` instead (same heredoc form).

`--source` is the label on the chip ("Draft email", "Release notes", "psql command") — a few
words, so the user knows what they're about to paste. Omit it if the content is self-evident.

The CLI sends **both** flavors: the converted HTML and a plain-text version derived from it
(list items become bullets, table cells stay tab-separated on one row), so a paste into a
plain editor still reads correctly. You don't pass the text separately.

## Report

On success the CLI prints how many lines went to how many viewers, e.g.
`Pushed 3 line(s) of rich text to 1 viewer(s)`. Tell the user it's waiting on their device
and that they tap **Copy** on the chip.

If it says **No client is viewing this session**, say so plainly — nothing is watching the
session right now, so the chip has nowhere to land; they should open the session on their
phone or in a browser, then run it again.

### Notes

- **When the Bash sandbox is on, run the push with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach.
- Must run **inside** a Codello session — the CLI reads `CODELLO_SESSION`. Outside one it
  exits with "Not in a Codello session"; pass `--session <id>` to target a specific one.
- If the CLI errors with **`unknown option '--md'`**, the installed Codello predates the
  markdown converter — tell the user to run `codello upgrade`, then retry.
- If the success line says `N line(s) of text` rather than `of rich text`, the running
  daemon predates the rich flavor and dropped it — tell the user to run `codello restart`
  and try again.
- `--md` does not read stdin, and `--md` with `--html` is an error (they're two spellings of
  the same flavor). Use the temp file.
- 128 KB limit across both flavors. For anything larger, point the user at the file instead
  of pasting it.
- Plain text is fine too: `codello copy "some text"` or `codello copy --file <path>` skips
  the rich flavor entirely. Reach for `--md` when formatting is the point.
- The chip stays until the user copies or dismisses it, so this works even if their phone is
  in their pocket right now.
