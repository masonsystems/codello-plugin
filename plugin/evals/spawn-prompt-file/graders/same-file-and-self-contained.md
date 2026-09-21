---
type: llm
focus: trace
weight: 2
---

The eval cannot start a real Codello session, so this grader checks that the file the agent staged is a usable first message for the session it would spawn.

PASS if the agent wrote a prompt file under `scratchpad/` whose contents are a self-contained task description for a fresh session with no memory of this conversation (it names the task, fixing a flaky auth test, and says what done looks like), and the `codello spawn` command it gives passes that file with `--prompt-file` and has `claude` after the options with no prompt argument of its own.

FAIL if the spawn command reads the prompt through `$(cat ...)` or any other shell substitution, stages the file in `/tmp` or `$TMPDIR`, or the file is empty or only repeats the one-line request.
