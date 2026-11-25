# Codello plugin for Claude Code

[Codello](https://codello.app/?ref=plugin-dir) puts every coding agent on every computer in one list, on your desktop and on your phone. When a Claude Code session needs you, you get a push and answer it from a chat view or the full terminal.

This plugin connects a Claude Code session to the Codello host on the same computer. With it, Claude can:

- Put a decision, a question, or a step for you to do on your phone, and get your answer back as a prompt.
- Ask you for an API key or password in a masked field, so the value never enters the conversation.
- Start titled sessions now, or schedule one to run later.
- Find and read other sessions on the computer, and send a message you approve to another session.
- Mark a session done, waiting on you, or failed.

## Install

```
/plugin marketplace add masonsystems/codello-plugin
/plugin install codello@codello-marketplace
```

## Requirements

- The `codello` CLI or the Codello Mac app, installed and signed in. [Install instructions](https://codello.app/docs) are in the Codello documentation.
- A Codello account. The trial runs 14 days with no card; Codello Pro is $15 a month after that.

Every hook passes its event on, and a Codello host that is down or refuses a call never fails a turn.

The commands, skills, and hooks are listed in [the repository README](https://github.com/masonsystems/codello-plugin#readme).
