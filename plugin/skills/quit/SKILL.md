---
name: quit
description: "End this Codello session when the task you were given succeeds, so the user never has to come back to it — `codello quit`. Use when the user's instruction ends with a quit clause: \"reply and quit\", \"ship it and quit\", \"close the ticket then quit\", \"do X and then close this session\", \"quit when you're done\", \"I don't need to hear back\", \"just do it and go away\". Also /codello:quit. Quit ONLY on success: if anything failed, was skipped, or needs a decision from the user, finish with a normal report instead and leave the session open."
---

# Quit the session when the task succeeds

The user told you to do something and then quit. Do the thing, and if it fully succeeded, end the session so nothing is left for them to check.

The session closes at the end of your turn, after your final reply is written, so the user can still read that reply later from the recently-closed list or `codello history`.

## The rule: quit only on success

"Quit" is conditional on the whole task working. Before you arm it, every one of these must be true:

- The task the user named is complete, not partially complete. A PR that is open but failing CI, a reply that bounced, a ticket you could not transition, a deploy that did not verify: none of these succeed.
- Every gate the task normally carries has run and passed. If the work is a code change, that includes tests, the Codex review, and any repo-mandated checks. The quit does not waive them.
- Nothing needs the user. No **Blocker**, no **Decision needed**, no question you would otherwise have asked, and no **Follow-up** they would have to act on.
- No background work of yours still matters. Quitting kills the process tree, so a `Monitor`, a background `Bash`, or a subagent you are waiting on dies with it. If one still has to finish, you are not done.
- The user did not also ask a question in the same message. A question wants an answer they will read, so leave the session open.

If any of those fails, do not quit. Write the report you would normally write, with the failure at the top, and end the turn. A session left open on a failure is the feature working. A session that vanished after a failure is the user finding out days later.

## How to quit

Once the task has succeeded, run this as your **last tool call**, with `dangerouslyDisableSandbox: true` (the CLI talks to the local server on `127.0.0.1:3847`, which a sandboxed command cannot reach):

```bash
codello quit
```

Expect:

```
Session quit armed. The next time this session goes idle, it will close.
```

Then write a one- or two-line final reply naming what was done and where it lives (the PR URL, the ticket, the message you sent), and end the turn. The close fires on the Stop hook, so your reply is recorded first and an in-flight turn is never cut off.

Nothing is armed until that line prints. If the command prints anything else, report exactly what it said and end the turn normally without quitting:

- `Not in a Codello session`: Codello did not spawn this PTY. Only a `codello claude` session, the web "new session" button, or a scheduled session can quit itself; a bare `claude` that Codello merely sees via hooks cannot.
- `Server not running`: the Codello server is down, so there is nothing to close the session. Finish normally.

## What the user sees

The session leaves every list as soon as your turn ends. No red dot, no push notification, no "waiting for you" state. For 10 seconds the terminal is still alive and Cmd-Shift-T (or the recently-closed list) brings it back intact; after that a reopen respawns the conversation with `--resume`. The transcript is never deleted.
