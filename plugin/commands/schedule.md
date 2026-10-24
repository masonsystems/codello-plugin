---
description: Schedule a pre-seeded Codello session to fire later in this directory
argument-hint: <what to do> <when> | list | remove <name>
allowed-tools: Bash
---

You are the front door to `codello schedule`. A scheduled run launches a **fresh** Claude Code run on this machine, in a chosen directory, at a cron or one-shot time. It inherits the real files, tools, and credentials of that directory but has **no memory of this conversation**, so the prompt you write must be fully self-contained.

A schedule fires in one of two modes:

- **Background** (`--background`): a headless `claude -p` child process. It has no session row, no viewer, and no permission prompt. It reads the same permission settings files as any Claude Code run in that directory, including `defaultMode`. A tool call that Claude Code denies for a missing allow rule is recorded as a permission denial, and the run is recorded as failed with the denied tool names. When a background run finishes, its final message is its result: the first 200 characters show on the run's row, and the full transcript is on the **Background runs** page and in `codello schedule runs`. A failed run sends a push to the user's phone and a bell notification.
- **Interactive**: a `claude "<prompt>"` session in a PTY. It shows up in the session list, the user can open it from a phone, and it can stop and ask a question or request a tool permission.

`$ARGUMENTS` is the user's request. Handle three shapes:

## 1. List

If `$ARGUMENTS` is "list" (or empty and the user clearly wants to see schedules):

```bash
codello schedule list
```

Show the output and stop. To show what past background runs did instead, use:

```bash
codello schedule runs            # every background run, newest first
codello schedule runs -n <name>  # just this schedule's runs
```

## 2. Remove

If `$ARGUMENTS` starts with "remove", "delete", or "cancel" followed by a name:

```bash
codello schedule remove <name>
```

## 3. Add (the default)

Otherwise the user is describing **what** to do and **when**. Do this:

1. **Capture the working directory** the schedule should run in. Default to the current directory:
   ```bash
   pwd
   ```
   Use that as `--cwd` unless the user named a different directory.

2. **Choose the mode. Background is the default.** Use `--background` for any unattended job that needs no answer from the user while it runs: checks, verifications, reports, sends of drafts the user already approved, and sweeps. A job that only reads, checks, and reports its result is always background, even when it runs commands such as `aws`, `kubectl`, or `jq`.

   Schedule an interactive session only when one of these is true:
   - The run must ask the user something partway through: a decision, an approval, or input nobody can supply in advance.
   - The user asked for a session: "open a session", "I want to drive it", "I'll take it from there".

   An explicit ask from the user wins either way: "in the background" or "headless" means `--background`. Say which mode you picked and why, in one clause, when you report.

3. **For a background schedule, check its permissions.** Nobody is there to approve a tool when it fires, so find out now whether the run is allowed to do its work.

   The host starts a background run as `claude -p` with no `--permission-mode` and no `--settings`, so the run's permissions come only from the settings files below. Rules from [Settings files and precedence](https://code.claude.com/docs/en/settings) and [Permission modes](https://code.claude.com/docs/en/permission-modes) decide what applies.

   a. **Find the four settings sources for that directory.** A missing file contributes nothing.
      - **Managed:** `/Library/Application Support/ClaudeCode/managed-settings.json` and `managed-settings.d/*.json` beside it on macOS, or `/etc/claude-code/` on Linux. Managed settings outrank every other file. An organization can also deliver them through MDM or the claude.ai console, which leave no file to read; if the user's account belongs to an organization, say that a policy you could not read may still apply.
      - **User:** `~/.claude/settings.json`.
      - **Shared project:** `<dir>/.claude/settings.json`, read from the schedule's working directory itself.
      - **Project local:** `.claude/settings.local.json` at the git repository root, not in `<dir>`, when `<dir>` is inside a repository. In a git worktree it is at the main checkout's root. This command prints that root in both cases:
        ```bash
        dirname "$(git -C <dir> rev-parse --path-format=absolute --git-common-dir)"
        ```
        The file stays at `<dir>/.claude/settings.local.json` when `<dir>` is not in a git repository or the repository root is the home directory. Claude Code also still reads a `<dir>/.claude/settings.local.json` that an older version left there.

   b. **Work out the effective `permissions.defaultMode`.**
      - A managed `defaultMode` wins. If managed settings set `permissions.disableAutoMode` to `"disable"`, auto mode is unavailable; if they set `permissions.disableBypassPermissionsMode` to `"disable"`, bypass mode is unavailable.
      - `auto` and `bypassPermissions` count only from managed settings or `~/.claude/settings.json`. A project or local file that sets either one does not apply it: for `auto`, Claude Code falls back to its built-in default, which is Manual (`default`) in a `-p` run, even when `~/.claude/settings.json` says `auto`; for `bypassPermissions`, the run starts in Manual.
      - Every other value (`default`, `acceptEdits`, `plan`, `dontAsk`) follows precedence: project local over shared project over user.
      - With no value anywhere, a `-p` run starts in Manual mode.
      - Auto mode also needs a model that supports it. Check the run's model against the requirements in [Permission modes](https://code.claude.com/docs/en/permission-modes); if it is not on the list, do not count on auto mode.

   c. **If the effective mode is `auto` or `bypassPermissions`, add no allow rules.** In `auto` mode the auto-mode classifier judges each tool call as it happens, so commands with no allow rule can still run. Tell the user this: an action the classifier blocks does not run, and Claude keeps working, so the run can still finish as succeeded with the work undone. Have the prompt's final message state anything it could not do (step 6). The `codello schedule add --background` plan prints "Write, Edit and Bash are denied by default"; that line does not apply in these modes, so do not act on it. Managed deny rules still apply in any mode. Go on to step 4.

   d. **Otherwise, list the tools the prompt needs, one by one.** Running a test suite or a build needs `Bash` for that exact command. Editing, fixing, or generating files needs `Edit` and `Write`. Reading a URL or an API needs `WebFetch` or `WebSearch`. Talking to a service through MCP needs that MCP tool. Committing, pushing, or opening a PR needs `Bash(git *)` and `Bash(gh *)`. A read-only task that only greps and reads the repository needs nothing added: `Read`, `Grep`, and `Glob` are available without an allow entry. What the mode already grants:
      - **`acceptEdits`** already allows `Edit` and `Write` inside the working directory, plus `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp`, and `sed` there. Other `Bash` commands, and edits outside the directory, still need allow rules.
      - **`plan`** never edits files in a `-p` run, and `Bash` commands outside the built-in read-only set are denied. If the task writes anything, refuse the background schedule and offer an interactive one.
      - **`default`** (Manual) and **`dontAsk`** grant nothing beyond reading.

   e. **Compare that list with the `permissions.allow` and `permissions.deny` entries** from all four sources. Allow lists merge across files. A deny entry wins over any allow entry, and managed deny rules apply in every mode. If managed settings set `allowManagedPermissionRulesOnly`, only managed allow rules count, so an allow rule you add to a user or project file does nothing. Then take exactly one of three outcomes:

      - **Every tool the task needs is already allowed.** Say so, name the entries that cover it, and go on to schedule.
      - **Something is missing and could reasonably be granted.** Propose the exact `allow` entries and the file to put them in, then **ask the user to approve adding them** and wait. Do not add a permission the user has not approved in that turn, and do not schedule until the entries are in place. Put them in the project local file from step 3a, at the repository root, unless the user names another file. Once approved, add them yourself and keep the rest of the file as it was:
        ```
        `nightly-tests` needs `Bash(npm run test *)` and `Bash(npx vitest *)`, and neither is allowed in ~/src/app/packages/api. Add these two to permissions.allow in ~/src/app/.claude/settings.local.json, the repository's local settings file?
        ```
      - **A needed tool is denied outright, managed settings block the rule you would add, or the user declines the allow entries.** Do not schedule the background run. Say which tool would be denied and what that costs: the work does not happen. Offer an interactive schedule instead, because an interactive session can ask at run time.

      Never work around a missing permission. There is no bypass flag, and a background run that is not allowed to do the work is not worth scheduling.

   Interactive schedules skip this step: they can ask.

4. **Derive a short kebab-case name** from the task (for example, "nightly review" becomes `nightly-review`). Keep it unique and stable.

5. **Parse the "when"** into one of these:
   - A 5-field cron expression for recurring runs. For example, "every day at 9am" is `0 9 * * *` and "weekdays at 8" is `0 8 * * 1-5`.
   - An ISO date and time for a one-shot. For example, "tomorrow at 3pm" is `2026-06-17T15:00`. Compute the absolute date from today if needed.

6. **Write a self-contained prompt to a temp file.** The scheduled Claude has no memory of this chat, so spell out the full task, the repository or directory context, and what "done" looks like. Never inline the prompt through shell quoting. Write it to a file and pass `--prompt-file`:
   ```bash
   cat > /tmp/ctg-schedule-prompt.txt <<'PROMPT'
   <the full, self-contained prompt>
   PROMPT
   ```

   **Write a background prompt for a run nobody is watching.** Say so in the prompt itself: never ask the user a question, never wait for input, and choose a reasonable default instead of pausing on an ambiguity.

   - **Make the final message the result.** Tell the run to end with a message whose first sentence says whether the check passed or failed and what it found. Only the first 200 characters show on the run's row, so put the verdict there, not a preamble. Tell the run to name every action that was blocked or skipped and what that left unchecked, because a blocked action does not always fail the run. A background prompt that ends with "let me know if you want me to…" has wasted the run.
   - **Do not depend on session commands.** A background run has no Codello session, so `codello done`, `codello session-status`, `codello decide`, and `codello emergency` have nothing to report to. Leave them out of a background prompt, and drop them from any prompt you adapt from an interactive one.
   - **Plan how a finding reaches the user.** A finished run never pushes; only a failed run does, and a run fails only on a tool call Claude Code records as a permission denial, a non-zero exit, or a Claude Code error. No Codello command lets a background run fail itself or send a push. If the user must be alerted when the job finds a problem, write the prompt to send the alert with a notification tool the run is already allowed to call in that directory, and name that tool in the prompt. If no such tool exists, tell the user that a finding shows up only on the run's row and in `codello schedule runs`.

7. **Validate with `--dry-run`.** It checks that the directory is a trusted Claude project, parses the trigger, and prints the computed next-fire time and the mode. It saves nothing:
   ```bash
   codello schedule add --dry-run \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     [--background] \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```

8. **Save it. Do not ask the user to confirm.** If the dry run parsed cleanly, run the real command at once, with the same flags and no `--dry-run`:
   ```bash
   codello schedule add \
     --name <name> --cwd "<dir>" --at "<cron|ISO>" \
     [--background] \
     --prompt-file /tmp/ctg-schedule-prompt.txt
   ```
   Then report the name, the next run in the user's local time zone, the cwd, whether it is **background or interactive**, a one-line summary of the prompt, and where the result shows up. For a background schedule, the result is on the run's row and the **Background runs** page, and in `codello schedule runs`; a failed run sends a push and a bell notification.

   `codello schedule remove <name>` reverses a schedule, so a confirmation round trip buys nothing. Stop and ask only if the dry run fails, if the request is ambiguous about *what* to run, or if a background run is missing a permission (step 3). Never stop merely to confirm a time you already parsed.

### Notes

- **When the Bash sandbox is on, run every `codello` call here with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach. `--dry-run` is the trap: it never contacts the server, so it passes sandboxed and only the real `add` fails.
- If `--dry-run` reports that the directory isn't a trusted Claude project, tell the user to open Claude there once and accept the trust dialog. A scheduled run in an untrusted directory hangs at the trust prompt and never delivers the prompt.
- The server must be running (`codello start`) for the schedule to fire and for background runs to be recorded. `codello schedule runs` reads them from the running server.
- Pass `--prompt-file` an **absolute path that `codello` itself can read**. If a sandbox redirected your `$TMPDIR`, the path you wrote to is not the path an unsandboxed `codello` resolves, and the add fails with `ENOENT`. Write the file, then pass the real absolute path you can `ls`.
- Add `--tz <IANA>` (for example, `America/Chicago`) only if the user wants a time zone other than this machine's.
