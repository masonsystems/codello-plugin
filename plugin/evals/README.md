# Plugin evals

Behavior tests for the plugin's commands and skills, run with [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Each directory here is one case: `prompt.md` is what the agent receives, `graders/` holds the checks, and `case.yaml` names a scaffold script when the case needs files in its working directory.

## Run them

From the `plugin/` directory:

```bash
claude plugin eval . --scaffold --allow-tools Write --ablation none
```

- `--scaffold` runs each case's `fixture.sh`, which builds a small project in the run's empty working directory. Every scaffold here is ours; read one before you pass the flag on a changed copy.
- `--allow-tools Write` lets the agent stage files. No case grants `Bash`, so no run can reach a Codello server or start a session.
- `--ablation none` skips the no-plugin arm: without the plugin there is no `/codello:*` command to run, so that arm measures nothing.

Each run is a full `claude -p` child on your own credential. The suite costs about $0.70 at three runs per case. Nothing runs these in CI yet.

## Cases

### `spawn-prompt-file`

[COD-1584, a spawned session started with an empty prompt](https://linear.app/masonsystems/issue/COD-1584/spawn-reject-empty-prompts-add-prompt-file-fix-skill-tmpdir-pitfall): `/codello:spawn` must stage the prompt in the session scratchpad and pass it with `--prompt-file`, never through `$TMPDIR`, `/tmp`, or `"$(cat ...)"`.

The run cannot start a real session, because an eval run has no Codello server and no `Bash`. The case gives the agent a scratchpad directory, the way Claude Code's environment does, and tells it to write out the shell commands it would run. The graders then check the command it gives:

- `prompt-file-in-scratchpad` and `writes-only-in-scratchpad`: the prompt file is written under `scratchpad/` and nowhere else.
- `spawns-with-prompt-file` and `no-cat-substitution`: the spawn command uses `--prompt-file` with a scratchpad path and has no `$(cat ...)`.
- `spawns-the-file-it-wrote`: the path given to `--prompt-file` names the same file the agent wrote.
- `same-file-and-self-contained`: a judge confirms the file is a usable first message for a fresh session.

That the file's contents arrive as the new session's first user message, byte for byte, is the CLI's half, tested in the Codello repository against a real spawn.
