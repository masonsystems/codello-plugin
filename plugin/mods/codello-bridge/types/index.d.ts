// Where the host server listens and the token it accepts. Read once from the
// environment at session start, then the token is unset so the agent's Bash
// children do not inherit it; kept here so a hot reload, which starts the
// module's own variables over, can still reach the host.
export type BridgeLink = { socketPath: string; token: string }

// A chat send the host handed over and the mod has not delivered yet.
export type BridgeSend = { id: string; text: string; isCommand: boolean }

// The main loop's turn as the mod tracks it, kept in session state so a hot
// reload takes up a turn already running and the sends it has not delivered.
export type BridgeTurn = {
  isRunning: boolean
  // Sends that arrived mid-turn. A text send waits for the next main tool
  // call to append it, or for the turn's end to submit it; a command waits
  // for the turn's end.
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
