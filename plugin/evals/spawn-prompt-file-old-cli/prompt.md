---
description: "COD-1584, older CLI: when `codello spawn --help` does not list --prompt-file, /codello:spawn falls back to a $(cat) of the scratchpad file, never of a $TMPDIR or /tmp path, and does not pass --prompt-file."
expected_outcome: "The agent writes a self-contained prompt file under scratchpad/, then gives `codello spawn -n <title> claude \"$(cat \"<that same file>\")\"` as the spawn command, with no --prompt-file."
tags: [spawn, cod-1584]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write]
append_system_prompt: |
  Scratchpad directory: scratchpad/ (a directory inside the current working directory). Always use it for temporary files instead of /tmp or $TMPDIR; it is the same path whether or not the Bash sandbox is on.
  The Bash tool is not available in this environment. When a step says to run a shell command, write out the exact command you would run, in a fenced bash block, instead of running it.
  The installed CLI predates --prompt-file: `codello spawn --help | grep -c -- --prompt-file` prints 0. Its full `codello spawn --help` output is:
    Usage: codetogo spawn [options] <command...>
    Options:
      -p, --port <port>  Port to run on (default: "3847")
      -n, --name <name>  Session name (defaults to command name)
      -w, --wait         Wait for command to complete and stream output
      -f, --force        Skip the cloud-connection warning (default: false)
      -h, --help         display help for command
---

/codello:spawn fix the flaky auth test in the current directory
