// Where the host server listens and the token it accepts. Read once from the
// environment at session start, then both variables are unset so the agent's
// Bash children do not inherit them; kept here so a hot reload, which starts
// the module's own variables over, can still reach the host. Any plugin can
// read this value, and any plugin's `http.fetch` hook sees the token in every
// request this mod makes, so keeping it out of state would hide it from none
// of them (docs/claude-code-io-surfaces.md in the Codello repo).
export type BridgeLink = { socketPath: string; token: string }

// A chat send the host handed over and the mod has not finished delivering.
//
// - `held`: it arrived mid-turn and waits for the next main tool call or the
//   turn's end.
// - `due`: the turn ended; its delivery is next. A reload that finds it here
//   delivers it, since the timer the last load set died with that load.
// - `sending`: its delivery started. A reload that finds it here reports it
//   unverified and never delivers it again, since it may already be in.
export type BridgeSendStage = 'held' | 'due' | 'sending'

export type BridgeSend = {
  id: string
  text: string
  isCommand: boolean
  stage: BridgeSendStage
  // Set with `due`: the turn it waited on was interrupted, so a text send is
  // appended rather than submitted, and a command is not run.
  isAfterAbort?: boolean
}

// The main loop's turn as the mod tracks it, kept in session state so a hot
// reload takes up a turn already running and the sends it has not delivered.
export type BridgeTurn = {
  isRunning: boolean
  // Sends that arrived mid-turn, in arrival order, until each one's delivery
  // has an outcome. A text send waits for the next main tool call to append
  // it, or for the turn's end to submit it; a command waits for the turn's end.
  held: BridgeSend[]
}

declare module 'claude-code' {
  interface PluginState {
    'codello-bridge': {
      link: BridgeLink | null
      turn: BridgeTurn
    }
  }
}
