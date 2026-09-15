---
description: Start new Codello sessions now — one fresh, titled claude session per task, each started in the project directory where that task's files and work live, ready to drive from the user's phone or web. Prefer this over team agents/subagents when the user will interact with the new sessions themselves, or the tasks aren't part of this session's work (other projects, independent chores).
argument-hint: <task> [in <dir>] [and <task> in <dir> ...]
allowed-tools: Bash
---

You are the front door to `codello spawn`. Each spawn launches a **fresh, detached**
`claude "<prompt>"` session on this machine, in that task's own directory, titled for
its task.
It appears immediately in the user's Codello session list (phone /
https://codello.app), where they can watch it, answer permission prompts, and steer it.
It has **no memory of this conversation**, so each prompt must be fully self-contained.

## When to use this (vs. team agents / subagents)

- **Use `/codello:spawn`** when the user is expected to interact with the new sessions
  directly, or when the tasks aren't really part of this session's work — e.g. a
  task-organization session kicking off independent agents across several projects.
  Each spawned session is a first-class, user-visible session of its own.
- **Use team agents / subagents instead** when the subtasks belong to *this* session's
  work and need to coordinate with it or report back — spawned sessions can't talk to
  this one.

## What to do

`$ARGUMENTS` describes one task or several. Start **one session per task**:

1. **Directory — start each session where its work lives.** The new session's whole
   world is the directory it starts in: it determines which files, tools, CLAUDE.md,
   and credentials the fresh claude sees. So pick the project/repo whose files the
   task actually touches — NOT, by default, wherever this conversation happens to be
   running. Resolve a named project to its absolute path; use the current dir only
   when the task is genuinely about this project. If you can't tell where a task's
   work lives, ask the user rather than guessing.

2. **Title.** Derive a short human title from the task (3–6 words, e.g. "Fix flaky
   auth test"). The session list shows `<dir-basename>: <title>`, so don't repeat the
   project name. Passing a title locks it — auto-naming won't overwrite it.

3. **Prompt.** Write a fully self-contained prompt to a temp file — the full task,
   any context the fresh session can't infer from the directory, and what "done"
   looks like. NEVER inline it through shell quoting:
   ```bash
   cat > /tmp/ctg-spawn-<slug>.txt <<'CTG_PROMPT_END'
   <the full, self-contained prompt>
   CTG_PROMPT_END
   ```
   Keep the prompt a brief (a few KB at most) — it is passed to `claude` as a
   command-line argument, so don't paste large file contents into it; point the
   new session at the files to read instead.

4. **Spawn** (detaches immediately; the first stdout line is the full session id):
   ```bash
   cd "<dir>" && codello spawn -n "<title>" claude "$(cat /tmp/ctg-spawn-<slug>.txt)"
   ```

5. **Repeat** for each remaining task, then report one line per session — title,
   directory, short session id — and that they're live in the user's session list.

If the task split or a target directory is genuinely ambiguous, show the plan and ask
first; otherwise spawn without asking — starting quickly is the point.

### Notes

- **When the Bash sandbox is on, run the spawn with `dangerouslyDisableSandbox: true`.** The CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command can never reach.
- The server auto-starts if it isn't running; the user must have logged in once
  (`codello login`).
- Each directory should be a trusted Claude project (open Claude there once and accept
  the trust dialog). In an untrusted dir the new session stalls at the trust prompt —
  the user *can* answer it from their phone, but warn them it's waiting.
- Don't pass extra flags to `claude` through `spawn` — unknown options are rejected.
  Put any needed behavior in the prompt instead.
- A "cloud disconnected" warning means the sessions still start locally but aren't
  reachable remotely — surface it to the user instead of ignoring it.
