---
description: Schedule a pre-seeded CodeToGo session to fire later in this directory
argument-hint: <what to do> <when> | list | remove <name>
allowed-tools: Bash
---

You are the front door to `codetogo schedule`. A scheduled run launches a **fresh**
Claude Code run on this machine, in a chosen directory, at a cron or one-shot time —
it inherits the real files/tools/creds of that dir but has **no memory of this
conversation**, so the prompt you write must be fully self-contained.

A schedule fires in one of two modes:

- **Interactive** (the default) — a `claude "<prompt>"` session in a PTY. It shows up
  in the session list, the user can open it from a phone, and it can stop and ask a
  question or request a tool permission.
- **Background** (`--background`) — a headless `claude -p` child process. No session
  row, no viewer, and **no permission prompt is ever shown**. If the run needs a tool
  permission that isn't already granted in that directory, the tool call is denied,
  the run is recorded as failed with the denied tool names, and the user gets a push
  and a bell notification. Results are read afterwards with `codetogo schedule runs`
  or on the **Background runs** page, which shows each run's full transcript.

`$ARGUMENTS` is the user's request. Handle three shapes:

## 1. List

If `$ARGUMENTS` is "list" (or empty and the user clearly wants to see schedules):

```bash
codetogo schedule list
```

Show the output and stop. To show what past background runs did instead, use:

```bash
codetogo schedule runs            # every background run, newest first
codetogo schedule runs -n <name>  # just this schedule's runs
```

## 2. Remove

If `$ARGUMENTS` starts with "remove" / "delete" / "cancel" followed by a name:

```bash
codetogo schedule remove <name>
```

## 3. Add (the default)

Otherwise the user is describing **what** to do and **when**. Do this:

1. **Capture the working directory** the schedule should run in. Default to the
   current dir:
   ```bash
   pwd
   ```
   Use that as `--cwd` unless the user named a different directory.

2. **Choose the mode: background or interactive.** The user's explicit ask wins —
   "in the background", "headless", "don't open a session" means `--background`;
   "I want to drive it", "open a session I can talk to" means interactive. With no
   explicit ask, pick from the nature of the task:
   - **Background** when the task is unattended by nature and produces a result
     rather than a conversation: run the tests, audit dependencies, sweep the open
     PRs, check a feed, write a report, "and notify me if anything is broken".
   - **Interactive** when the user will want to steer the session, or the task
     obviously has to ask something: triage and decide, draft something for review,
     fix whatever the failure turns out to be, anything open-ended.

   Say which mode you picked and why, in one clause, when you report.

3. **Before a background schedule, check the permissions it will need.** Nobody is
   there to approve a tool at fire time, so a missing permission costs the whole run.
   Work it out before you schedule, not after it fails:

   a. **Think about which tools the prompt actually requires.** Running a test suite
      or a build needs `Bash` for that exact command. Editing, fixing, or generating
      files needs `Edit` and `Write`. Reading a URL or an API needs `WebFetch` or
      `WebSearch`. Talking to a service through MCP needs that MCP tool. Committing,
      pushing, or opening a PR needs `Bash(git …)` and `Bash(gh …)`. A read-only
      audit that only greps the repo needs nothing beyond `Read`, `Grep`, and `Glob`,
      which are always available.

   b. **Read the settings that apply in the target directory** and collect their
      `permissions.allow` entries, noting `permissions.deny` too — a deny entry wins
      over any allow:
      ```bash
      cat <dir>/.claude/settings.json
      cat <dir>/.claude/settings.local.json
      cat ~/.claude/settings.json
      ```
      A missing file is normal; treat it as contributing nothing.

   c. **If every tool the task needs is already allowed, schedule it.** If anything
      it needs is missing or denied, **do not schedule**. Tell the user which
      permissions are missing, give the exact entries to add and the file to add them
      to, and offer to schedule it interactively instead — an interactive session can
      ask, so it is the working answer for a task the user won't pre-authorize. For
      example:
      > `nightly-tests` needs `Bash(npm test:*)`, which isn't allowed in
      > `~/src/app`. Add it to `~/src/app/.claude/settings.local.json` under
      > `permissions.allow`, or I can schedule this as an interactive session that
      > can ask you at run time.

   Interactive schedules skip this step entirely: they can ask.

4. **Derive a short kebab-case name** from the task (e.g. "nightly review" →
   `nightly-review`). Keep it unique and stable.

5. **Parse the "when"** into either:
   - a 5-field cron expression for recurring runs (e.g. "every day at 9am" →
     `0 9 * * *`, "weekdays at 8" → `0 8 * * 1-5`), or
   - an ISO date/time for a one-shot (e.g. "tomorrow at 3pm" →
     `2026-06-17T15:00`). Compute the absolute date from today if needed.

6. **Write a self-contained prompt to a temp file.** The scheduled Claude has no
   memory of this chat, so spell out the full task, the repo/dir context, and what
   "done" looks like. NEVER inline the prompt through shell quoting — write it to a
   file and pass `--prompt-file`:
   ```bash
   cat > /tmp/ctg-schedule-prompt.txt <<'PROMPT'
   <the full, self-contained prompt>
   PROMPT
   ```

   **A background prompt is written for nobody watching.** Say so in the prompt
   itself: never ask the user a question, never wait for input, and choose a
   reasonable default instead of pausing on an ambiguity. Tell it to finish with a
   short result line saying whether the task succeeded or failed and what the outcome
   was — that line is what the user reads first in the run's transcript. A background
   prompt that ends with "let me know if you want me to…" has wasted the run.

7. **Validate with `--dry-run`** (checks the cwd is a trusted Claude dir, parses the
   trigger, prints the computed next-fire time and the mode — saves nothing):
   ```bash
   codetogo schedule add --dry-run \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     [--background] \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```

8. **Save it — do not ask the user to confirm.** If the dry run parsed cleanly, run
   the real command immediately (same flags, no `--dry-run`):
   ```bash
   codetogo schedule add \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     [--background] \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```
   Then report: the name, the next run in the user's local zone, the cwd, whether it
   is **background or interactive**, a one-line summary of the prompt, and where the
   result will show up. For a background schedule, that last part is: `codetogo
   schedule runs` or the **Background runs** page, where the transcript is readable,
   and a push plus a bell if the run fails.

   A schedule is trivially reversible with `codetogo schedule remove <name>`, so a
   confirmation round trip buys nothing. Only stop and ask if the dry run fails, if
   the request is genuinely ambiguous about *what* to run, or if a background run is
   missing a permission (step 3) — never merely to confirm a time you already parsed.

### Notes

- **When the Bash sandbox is on, run every `codetogo` call here with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach. `--dry-run` is the trap: it never contacts the server, so it passes sandboxed and only the real `add` fails.
- If `--dry-run` reports the dir isn't a trusted Claude project, tell the user to
  open Claude there once and accept the trust dialog — a scheduled run in an
  untrusted dir hangs at the trust prompt and never delivers the prompt.
- The server must be running (`codetogo start`) for the schedule to fire, and for
  background runs to be recorded — `codetogo schedule runs` reads them from the
  running server.
- Pass `--prompt-file` an **absolute path that `codetogo` itself can read**. If a
  sandbox redirected your `$TMPDIR`, the path you wrote to is not the path an
  unsandboxed `codetogo` resolves, and the add fails with `ENOENT`. Write the file,
  then pass the real absolute path you can `ls`.
- Add `--tz <IANA>` (e.g. `America/Chicago`) only if the user wants a zone other
  than this machine's.
