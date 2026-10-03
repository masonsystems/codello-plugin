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

Each run is a full `claude -p` child on your own credential. The suite costs about $1.50 at three runs per case; add `-j 3` to run three at once. Nothing runs these in CI yet.

## Cases

### `spawn-prompt-file` and `spawn-prompt-file-old-cli`

[COD-1584, a spawned session started with an empty prompt](https://linear.app/masonsystems/issue/COD-1584/spawn-reject-empty-prompts-add-prompt-file-fix-skill-tmpdir-pitfall): `/codello:spawn` must stage the prompt in the session scratchpad, never in `$TMPDIR` or `/tmp`. The skill checks `codello spawn --help` for `--prompt-file`. A CLI that has it gets `--prompt-file`; an older CLI gets `"$(cat "<scratchpad file>")"`, which is safe only because the scratchpad is the same path inside and outside the sandbox.

The run cannot start a real session, because an eval run has no Codello server and no `Bash`. Each case gives the agent a scratchpad directory, the way Claude Code's environment does, tells it to write out the shell commands it would run, and states what the `--help` check prints: 1 in `spawn-prompt-file`, 0 with the old help text in `spawn-prompt-file-old-cli`. The graders then check the command it gives.

Both cases:

- `prompt-file-in-scratchpad` and `writes-only-in-scratchpad`: the prompt file is written under `scratchpad/` and nowhere else.
- `spawns-the-file-it-wrote`: the path in the spawn command names the same file the agent's Write call created. The pattern anchors on the Write call's `file_path`, so the command's own path cannot satisfy it.

`spawn-prompt-file`, the current CLI:

- `spawns-with-prompt-file` and `no-cat-substitution`: the spawn command uses `--prompt-file` with a scratchpad path and has no `$(cat ...)`.
- `same-file-and-self-contained`: a judge confirms the file is a usable first message for a fresh session. Step 3 of the skill, which writes the file, is the same on both branches, so this case's judge covers both.

`spawn-prompt-file-old-cli`, a CLI without `--prompt-file`:

- `falls-back-to-scratchpad-cat` and `no-prompt-file-flag`: the spawn command passes `claude "$(cat "<scratchpad path>")"` and no `--prompt-file`; the `--help` check line does not count.
- `no-tmp-substitution`: no substitution reads a `/tmp` or `$TMPDIR` path outside `scratchpad/`. The run's own working directory is under `/private/tmp`, so a path through `scratchpad/` is allowed.

The two scratchpad graders, `prompt-file-in-scratchpad` and `writes-only-in-scratchpad`, pass on the harness system prompt alone: it tells the agent to use `scratchpad/` for temporary files, so an agent with no skill at all writes there too. They guard against a regression that stages the file elsewhere, but they do not show the skill works. The spawn-command graders and the judge carry that check, because only the skill tells the agent to use `--prompt-file`, to check `--help`, or to fall back to a quoted `$(cat)`.

That the file's contents arrive as the new session's first user message, byte for byte, is the CLI's half, tested in the Codello repository against a real spawn.
