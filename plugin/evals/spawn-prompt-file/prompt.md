---
description: "COD-1584, current CLI: /codello:spawn stages the prompt in the session scratchpad and passes it with --prompt-file, never through $TMPDIR, /tmp, or a $(cat) substitution."
expected_outcome: "The agent writes a self-contained prompt file under scratchpad/, then gives `codello spawn -n <title> --prompt-file <that same file> claude` as the spawn command, with no $(cat ...)."
tags: [spawn, cod-1584]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write]
append_system_prompt: |
  Scratchpad directory: scratchpad/ (a directory inside the current working directory). Always use it for temporary files instead of /tmp or $TMPDIR; it is the same path whether or not the Bash sandbox is on.
  The Bash tool is not available in this environment. When a step says to run a shell command, write out the exact command you would run, in a fenced bash block, instead of running it.
  The installed CLI is current: `codello spawn --help | grep -c -- --prompt-file` prints 1.
---

/codello:spawn fix the flaky auth test in the current directory
