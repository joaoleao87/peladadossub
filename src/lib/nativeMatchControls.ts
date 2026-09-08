import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type NativeControlAction = 'GOAL_HOME' | 'GOAL_AWAY' | 'HIGHLIGHT' | 'UNDO'

interface MatchControlsPlugin {
  start(options: NativeMatchState): Promise<void>
  update(options: NativeMatchState): Promise<void>
  stop(): Promise<void>
  addListener(eventName: 'controlAction', listener: (event: { action: NativeControlAction }) => void): Promise<PluginListenerHandle>
}

export interface NativeMatchState {
  title: string
  score: string
  subtitle: string
  remainingMs: number
  running: boolean
}

const plugin = registerPlugin<MatchControlsPlugin>('MatchControls')

export const nativeMatchControls = {
  available: Capacitor.isNativePlatform(),
  start: (state: NativeMatchState) => plugin.start(state),
  update: (state: NativeMatchState) => plugin.update(state),
  stop: () => plugin.stop(),
  onAction: (listener: (action: NativeControlAction) => void) =>
    plugin.addListener('controlAction', event => listener(event.action)),
}
