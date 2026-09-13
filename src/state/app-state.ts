export type AppState =
  | 'idle'
  | 'requesting-camera'
  | 'initializing'
  | 'coaching'
  | 'floor-candidate'
  | 'floor-locked'
  | 'ready-to-place'
  | 'placed'
  | 'tracking-lost'
  | 'error'

export interface AppSnapshot {
  state: AppState
  message?: string
  warning?: string
}

type Listener = (snapshot: AppSnapshot) => void

export class AppStateStore {
  private snapshot: AppSnapshot = {state: 'idle'}
  private readonly listeners = new Set<Listener>()

  get current(): AppSnapshot {
    return this.snapshot
  }

  set(state: AppState, details: Omit<AppSnapshot, 'state'> = {}): void {
    this.snapshot = {state, ...details}
    this.listeners.forEach(listener => listener(this.snapshot))
    console.info('[state]', state, details.message ?? '')
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }
}
