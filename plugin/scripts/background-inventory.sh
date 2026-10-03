#!/usr/bin/env bash
# Inventory the background work started in THIS claude session, so a context
# reset can restart what still matters.
#
# Why this exists: a `compact` swap kills the outgoing claude with
# killProcessTree() (src/server/pty-manager.ts), so every Monitor and every
# background Bash task dies with it, mid-flight. Claude Code's own /compact
# leaves them running but stops delivering their notifications — measured at
# 32 of 656 background tasks notifying when a compaction fell inside their
# window, against 725 of 1069 when none did. Either way the work goes dark and
# the agent stops hearing about it, so the handoff has to carry enough to
# re-arm it deliberately.
#
#   background-inventory.sh                 live tasks only, as Markdown for a handoff
#   background-inventory.sh --all           also list the ones that already finished
#   background-inventory.sh <session-id>    inventory ANOTHER conversation (or a
#   background-inventory.sh <path.jsonl>    transcript path) — for a replacement
#                                           agent reading the session it took over
#
# Reads the session transcript, never the live process table: what matters is
# what was started and never reported done. Prints "_No background tasks._"
# and exits 0 when there is nothing — always safe to call from a hot path.
set -uo pipefail

FLAG=""
TARGET=""
for a in "$@"; do
  case "$a" in
    --all) FLAG="--all" ;;
    "") ;;
    *) TARGET="$a" ;;
  esac
done

if [ -n "$TARGET" ] && [ -f "$TARGET" ]; then
  TRANSCRIPT="$TARGET"
else
  # A bare id may be given as `cc/<id>`, the form aii and the handoff both use.
  SID="${TARGET#cc/}"
  [ -z "$SID" ] && SID="${CLAUDE_CODE_SESSION_ID:-}"
  if [ -z "$SID" ]; then
    echo "_Background inventory unavailable (CLAUDE_CODE_SESSION_ID unset)._"
    exit 0
  fi
  TRANSCRIPT=$(ls -1 "$HOME"/.claude/projects/*/"$SID".jsonl 2>/dev/null | head -1)
  if [ -z "$TRANSCRIPT" ]; then
    echo "_Background inventory unavailable (no transcript for session $SID)._"
    exit 0
  fi
fi

command -v node >/dev/null 2>&1 || { echo "_Background inventory unavailable (node not on PATH)._"; exit 0; }

node - "$TRANSCRIPT" "$FLAG" <<'NODE'
const fs = require('fs');
const path = require('path');
const [, , file, flag] = process.argv;
const showAll = flag === '--all';

const MAX_LISTED = 12;      // a handoff is not a log dump
const MAX_CMD = 900;        // enough to re-arm verbatim
const MAX_TAIL = 3;         // lines of recent output per task

const blocks = (e) => {
  const c = e?.message?.content;
  return Array.isArray(c) ? c : [];
};
// Task notifications are NOT stored in message.content. Claude Code writes them
// as `queue-operation` entries (content) and `attachment` entries of
// commandMode "task-notification" (prompt) — a notification that lands while a
// turn is running is enqueued and then removed with reason "absorbed_mid_turn".
// Read all three shapes; missing the first two makes every finished task look
// like it is still running.
const notificationText = (e) => {
  if (e?.type === 'queue-operation' && typeof e.content === 'string') return e.content;
  const a = e?.attachment;
  if (a && a.commandMode === 'task-notification' && typeof a.prompt === 'string') return a.prompt;
  const c = e?.message?.content;
  if (typeof c === 'string') return c;
  let s = '';
  for (const b of blocks(e)) {
    if (b.type === 'text') s += b.text || '';
    else if (b.type === 'tool_result') s += typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '');
  }
  return s;
};

const starts = new Map();          // taskId -> {kind, desc, cmd, persistent, timeoutMs}
const terminal = new Set();        // taskId that has reported a terminal state
const outFile = new Map();         // taskId -> absolute .output path
const pending = new Map();         // tool_use id -> start record awaiting its task id

let lines = [];
try {
  lines = fs.readFileSync(file, 'utf8').split('\n');
} catch {
  console.log('_Background inventory unavailable (transcript unreadable)._');
  process.exit(0);
}

for (const line of lines) {
  if (!line.trim()) continue;
  let e;
  try { e = JSON.parse(line); } catch { continue; }

  for (const b of blocks(e)) {
    if (b.type === 'tool_use') {
      const inp = b.input || {};
      if (b.name === 'Monitor') {
        pending.set(b.id, {
          kind: 'monitor',
          desc: inp.description || '',
          cmd: inp.command || (inp.ws ? `[websocket] ${JSON.stringify(inp.ws)}` : ''),
          persistent: !!inp.persistent,
          timeoutMs: inp.timeout_ms,
        });
      } else if (b.name === 'Bash' && inp.run_in_background) {
        pending.set(b.id, { kind: 'bash', desc: inp.description || '', cmd: inp.command || '' });
      } else if (b.name === 'TaskStop' && inp.task_id) {
        // An explicit stop is terminal even though it emits no notification.
        terminal.add(inp.task_id);
      }
    } else if (b.type === 'tool_result') {
      const rec = pending.get(b.tool_use_id);
      if (!rec) continue;
      const c = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '');
      const m = c.match(/Monitor started \(task (\w+)/) || c.match(/background with ID: (\w+)/);
      if (m) {
        starts.set(m[1], rec);
        const om = c.match(/written to: (\S+?\.output)/);
        if (om) outFile.set(m[1], om[1]);
      }
      pending.delete(b.tool_use_id);
    }
  }

  // Terminal states arrive only inside a task notification. Scope the id match
  // to that block so an agent that merely printed a task id somewhere else
  // (grepping its own transcript, say) can't retire a task that is still live.
  const t = notificationText(e);
  if (!t.includes('<task-notification>')) continue;
  for (const chunk of t.split('<task-notification>').slice(1)) {
    const idm = chunk.match(/<task-id>(\w+)<\/task-id>/);
    if (!idm) continue;
    const id = idm[1];
    const om = chunk.match(/<output-file>(\S+?)<\/output-file>/);
    if (om) outFile.set(id, om[1]);
    // A Monitor *event* is not terminal — it is the monitor doing its job. The
    // terminal shapes are an explicit <status>, and the timeout kill, which
    // arrives as an event rather than a status.
    if (/<status>/.test(chunk) || chunk.includes('[Monitor timed out')) terminal.add(id);
  }
}

const live = [...starts.entries()].filter(([id]) => !terminal.has(id));
const done = [...starts.entries()].filter(([id]) => terminal.has(id));

if (live.length === 0 && !(showAll && done.length)) {
  console.log('_No background tasks are live in this session._');
  process.exit(0);
}

const trunc = (s, n) => (s.length > n ? `${s.slice(0, n)}\n… [truncated, ${s.length} chars total]` : s);
const oneLine = (s) => s.replace(/\s+/g, ' ').trim();

// A recorded command can itself contain a Markdown fence — a heredoc that writes
// a README, say. Open with a fence longer than the longest backtick run inside,
// or the block ends early and the rest of the command leaks into the handoff as
// prose the next agent may re-arm wrong.
const fenceFor = (s) => {
  let longest = 0;
  for (const m of s.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
};

const tail = (id) => {
  const f = outFile.get(id);
  if (!f) return null;
  try {
    const out = fs.readFileSync(f, 'utf8').trimEnd();
    if (!out) return null;
    const rows = out.split('\n');
    return rows.slice(-MAX_TAIL).join('\n').slice(0, 400);
  } catch {
    return null;
  }
};

const out = [];
out.push(`## Background Tasks (${live.length} live)`);
out.push('');
if (live.length) {
  out.push('These were started in the outgoing session and **were never reported finished**. A');
  out.push('compact swap kills them outright, so nothing below survives into the new session.');
  out.push('Re-arm the ones the work still depends on; drop the rest deliberately.');
} else {
  out.push('Nothing is still running — nothing to re-arm.');
}
out.push('');

const shown = live.slice(0, MAX_LISTED);
for (const [id, r] of shown) {
  const bits = [r.kind];
  if (r.kind === 'monitor') bits.push(r.persistent ? 'persistent' : `timeout ${Math.round((r.timeoutMs ?? 300000) / 60000)}m`);
  out.push(`### \`${id}\` — ${oneLine(r.desc) || '(no description)'}`);
  out.push(`*${bits.join(' · ')}* · restart: **decide** (keep / drop)`);
  out.push('');
  const cmd = trunc(r.cmd.trim(), MAX_CMD);
  out.push(`${fenceFor(cmd)}bash`);
  out.push(cmd);
  out.push(fenceFor(cmd));
  const t = tail(id);
  if (t) {
    out.push('');
    out.push(`Last output (${outFile.get(id)}):`);
    out.push(fenceFor(t));
    out.push(t);
    out.push(fenceFor(t));
  }
  out.push('');
}
if (live.length > shown.length) {
  out.push(`_…and ${live.length - shown.length} more live task(s); see the transcript._`);
  out.push('');
}

if (showAll && done.length) {
  out.push(`### Already finished (${done.length}) — no action`);
  for (const [id, r] of done) out.push(`- \`${id}\` ${r.kind} — ${oneLine(r.desc) || '(no description)'}`);
  out.push('');
}

console.log(out.join('\n'));
NODE
