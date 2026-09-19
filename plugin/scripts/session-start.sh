#!/usr/bin/env bash
# SessionStart hook: tell the agent which `codello` commands it is expected to
# run on its own, and when. This is the deterministic layer; the plugin's skills
# (waiting, done, quit, secrets, cli) carry the rules and load on demand.
#
# No-op outside a Codello session, so the plugin costs nothing in an unrelated
# Claude session: the server sets CODELLO_SESSION (and, during the rename
# window, CODETOGO_SESSION) in every PTY it spawns. If neither is set, or the
# CLI is not on PATH, print nothing and exit 0.

if [ -z "${CODELLO_SESSION:-}${CODETOGO_SESSION:-}" ]; then
  exit 0
fi
if ! command -v codello >/dev/null 2>&1; then
  exit 0
fi

# Static JSON, no jq: the text below is the whole payload, kept to a few lines
# because it is read on every session start.
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This is a Codello session: the user drives it from a phone or browser and reads the session row, not the terminal. Run these codello commands yourself, with dangerouslyDisableSandbox: true; the codello:* skills carry the rules.\n- codello session-status set waiting -m \"<what the user has to do>\" when a turn ends on something only the user can do: a PR up for their review, a question or decision, a permission you cannot grant, a blocker only they can clear. codello session-status clear when the wait ends. Skill: codello:waiting.\n- codello done -m \"<what happened>\" when the task is finished and nothing is left for the user; codello done --failed -m \"<what stopped you>\" when it cannot be done. Never in the same turn as set waiting. Skill: codello:done.\n- codello quit only when the user told you to quit after success. Skill: codello:quit.\n- codello secret request --reason \"...\" when you need a credential; never ask the user to paste one into the chat. Skill: codello:secrets."}}
JSON
