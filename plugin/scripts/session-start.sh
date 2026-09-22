#!/usr/bin/env bash
# SessionStart hook: tell the agent which `codello` commands it is expected to
# run on its own, and when. This is the deterministic layer; the plugin's skills
# (waiting, done, quit, secrets, emergency, cli) carry the rules and load on demand.
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
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This is a Codello session: the user drives it from a phone or browser and reads the session row, not the terminal. Run these codello commands yourself, with dangerouslyDisableSandbox: true; the codello:* skills carry the rules.\n- codello session-status set waiting -m \"<what the user has to do>\" when a turn ends on something only the user can do: a PR up for their review, a question or decision, a permission you cannot grant, a blocker only they can clear. Run it silently before your final reply and never mention the command or the status in the reply; the -m line is the push the user reads, so put what you need from them in it. codello session-status clear if the wait ends without them replying; their reply retires it on its own. Skill: codello:waiting.\n- codello done -m \"<what happened>\" when the task is finished and nothing is left for the user; codello done --failed -m \"<what stopped you>\" when it cannot be done. Never in the same turn as set waiting. Skill: codello:done.\n- codello quit only when the user told you to quit after success. Skill: codello:quit.\n- codello secret list, then codello secret request NAME --reason \"...\" when you need a credential, and \"$(codello secret get NAME)\" each time you use it; never ask the user to paste one into the chat. Skill: codello:secrets.\n- Only the session's lead agent runs these. If another agent spawned you, as a subagent or a teammate, you share the lead's session: report your result to the agent that spawned you and never report the session.\n- The one exception: any agent, lead or not, runs codello emergency -m \"<what is broken and its impact; what you did>\" the moment it finds harm happening now that it cannot fix or contain itself, such as a production outage, data loss, leaked credentials, a destructive action gone wrong, or runaway cost. It sends a Time Sensitive push immediately. Contain what you safely can first, raise it once, and keep mitigating. Never for blockers, questions, failing tests, or finished work. Skill: codello:emergency."}}
JSON
