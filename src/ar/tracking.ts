import type {AppStateStore} from '../state/app-state'
import type {RealityResult} from './xr-types'

const READY_NORMAL_FRAMES = 24
const LOST_LIMITED_FRAMES = 10

export interface TrackingSnapshot {
  status: string
  reason: string
  normalFrames: number
  limitedFrames: number
}

export class TrackingController {
  private normalFrames = 0
  private limitedFrames = 0
  private status = 'UNKNOWN'
  private reason = 'UNSPECIFIED'

  constructor(
    private readonly store: AppStateStore,
    private readonly hasPlacement: () => boolean,
  ) {}

  update(reality?: RealityResult): void {
    if (!reality?.trackingStatus) return

    this.status = reality.trackingStatus
    this.reason = reality.trackingReason ?? 'UNSPECIFIED'

    if (this.status === 'NORMAL') {
      this.normalFrames += 1
      this.limitedFrames = 0

      if (this.normalFrames >= READY_NORMAL_FRAMES) {
        if (this.hasPlacement()) {
          if (this.store.current.state === 'tracking-lost') this.store.set('placed')
        } else if (
          this.store.current.state === 'coaching' ||
          this.store.current.state === 'tracking-lost'
        ) {
          this.store.set('ready-to-place')
        }
      }
      return
    }

    this.normalFrames = 0
    this.limitedFrames += 1
    if (
      this.limitedFrames >= LOST_LIMITED_FRAMES &&
      ['coaching', 'ready-to-place', 'placed'].includes(this.store.current.state)
    ) {
      this.store.set('tracking-lost')
    }
  }

  resetForPlacement(): void {
    if (this.status === 'NORMAL' && this.normalFrames >= READY_NORMAL_FRAMES) {
      this.store.set('ready-to-place')
    } else {
      this.store.set('coaching')
    }
  }

  snapshot(): TrackingSnapshot {
    return {
      status: this.status,
      reason: this.reason,
      normalFrames: this.normalFrames,
      limitedFrames: this.limitedFrames,
    }
  }
}
