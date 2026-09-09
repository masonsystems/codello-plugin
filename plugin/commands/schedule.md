---
description: Schedule a pre-seeded Codello session to fire later in this directory
argument-hint: <what to do> <when> | list | remove <name>
allowed-tools: Bash
---

You are the front door to `codello schedule`. A scheduled run launches a **fresh**
`claude "<prompt>"` session on this machine, in a chosen directory, at a cron or
one-shot time — it inherits the real files/tools/creds of that dir but has **no
memory of this conversation**, so the prompt you write must be fully self-contained.

`$ARGUMENTS` is the user's request. Handle three shapes:

## 1. List

If `$ARGUMENTS` is "list" (or empty and the user clearly wants to see schedules):

```bash
codello schedule list
```

Show the output and stop.

## 2. Remove

If `$ARGUMENTS` starts with "remove" / "delete" / "cancel" followed by a name:

```bash
codello schedule remove <name>
```

## 3. Add (the default)

Otherwise the user is describing **what** to do and **when**. Do this:

1. **Capture the working directory** the schedule should run in. Default to the
   current dir:
   ```bash
   pwd
   ```
   Use that as `--cwd` unless the user named a different directory.

2. **Derive a short kebab-case name** from the task (e.g. "nightly review" →
   `nightly-review`). Keep it unique and stable.

3. **Parse the "when"** into either:
   - a 5-field cron expression for recurring runs (e.g. "every day at 9am" →
     `0 9 * * *`, "weekdays at 8" → `0 8 * * 1-5`), or
   - an ISO date/time for a one-shot (e.g. "tomorrow at 3pm" →
     `2026-06-17T15:00`). Compute the absolute date from today if needed.

4. **Write a self-contained prompt to a temp file.** The scheduled Claude has no
   memory of this chat, so spell out the full task, the repo/dir context, and what
   "done" looks like. NEVER inline the prompt through shell quoting — write it to a
   file and pass `--prompt-file`:
   ```bash
   cat > /tmp/ctg-schedule-prompt.txt <<'PROMPT'
   <the full, self-contained prompt>
   PROMPT
   ```

5. **Validate with `--dry-run`** (checks the cwd is a trusted Claude dir, parses the
   trigger, prints the computed next-fire time — saves nothing):
   ```bash
   codello schedule add --dry-run \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```

6. **Save it — do not ask the user to confirm.** If the dry run parsed cleanly, run
   the real command immediately (same flags, no `--dry-run`):
   ```bash
   codello schedule add \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```
   Then report what was scheduled: name, next run in the user's local zone, cwd, and
   a one-line summary of the prompt. A schedule is trivially reversible with
   `codello schedule remove <name>`, so a confirmation round trip buys nothing.
   Only stop and ask if the dry run fails, or the request is genuinely ambiguous
   about *what* to run — never merely to confirm a time you already parsed.

### Notes

- **When the Bash sandbox is on, run every `codello` call here with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach. `--dry-run` is the trap: it never contacts the server, so it passes sandboxed and only the real `add` fails.
- If `--dry-run` reports the dir isn't a trusted Claude project, tell the user to
  open Claude there once and accept the trust dialog — a scheduled run in an
  untrusted dir hangs at the trust prompt and never delivers the prompt.
- The server must be running (`codello start`) for the schedule to fire.
- Pass `--prompt-file` an **absolute path that `codello` itself can read**. If a
  sandbox redirected your `$TMPDIR`, the path you wrote to is not the path an
  unsandboxed `codello` resolves, and the add fails with `ENOENT`. Write the file,
  then pass the real absolute path you can `ls`.
- Add `--tz <IANA>` (e.g. `America/Chicago`) only if the user wants a zone other
  than this machine's.
