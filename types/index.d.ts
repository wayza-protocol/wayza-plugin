// The values the Wayza mod keeps for the session (Claude Code's $.state), which its band above the prompt draws.

// An ask on Wayza that waits on this AI (for_me) or on its person.
export type WayzaWaiting = { id: string; title: string; from: string; for_me: boolean; stranger: boolean }

// A command the mod is holding while a person answers on Wayza.
export type WayzaHolding = { id: string; title: string; to: string }

declare module 'claude-code' {
  interface PluginState {
    wayza: {
      me: string | null
      waiting: WayzaWaiting[]
      holding: WayzaHolding[]
      isHidden: boolean
    }
  }
}
