#!/bin/sh
# PreToolUse hook on Bash: let an agent run its own `codello session-status`,
# `codello decide`, and `codello done` without a permission prompt (COD-2549).
#
# The plugin tells every agent to run these, and each only reports to the user.
# An allow rule such as `Bash(codello session-status *)` misses some of them:
# Claude Code splits a command at a `;` even inside a quoted -m message, and a
# decide heredoc can land on a prompt too. The codello CLI decides: it prints an
# allow decision only when the whole command is one such call, and nothing
# otherwise, which leaves the call to the normal permission flow. The rules are
# in the CLI's `src/cli/allow-reporting-hook.ts` and in docs/claude-code-hooks.md
# in the Codello repository.
#
# Every path exits 0 and prints either nothing or the CLI's JSON. Claude Code
# shows a hook error notice for any other non-zero exit, so a CLI that predates
# `codello hook allow-reporting` (it exits 1 with "unknown command") must stay
# silent and leave the call to the normal flow.

# Outside a Codello session these commands report to nobody: no decision.
if [ -z "${CODELLO_SESSION:-}${CODETOGO_SESSION:-}" ]; then
  exit 0
fi

payload=$(cat)

# Most Bash calls never name the CLI; skip starting node for them.
case $payload in
  *codello*|*codetogo*) ;;
  *) exit 0 ;;
esac

# The session's own PATH comes first, so the hook asks the same codello the
# agent runs. It may lack the CLI, so fall back to the directories the
# installer and the macOS app use, the ones the CLI's hook wrapper searches.
PATH="$PATH:$HOME/.codetogo/bin:$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin"
export PATH

for bin in codello codetogo; do
  if command -v "$bin" >/dev/null 2>&1; then
    out=$(printf '%s' "$payload" | "$bin" hook allow-reporting 2>/dev/null) || exit 0
    case $out in
      '{"hookSpecificOutput":'*) printf '%s\n' "$out" ;;
    esac
    exit 0
  fi
done
exit 0
