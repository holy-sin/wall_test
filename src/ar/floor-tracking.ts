import * as THREE from 'three'
import type {PartitionScene} from '../scene/scene'
import type {AppStateStore} from '../state/app-state'
import type {UiController} from '../ui/ui'
import type {HitTestResult, RealityResult, XR8Api} from './xr-types'

const SAMPLE_INTERVAL_FRAMES = 3
const REQUIRED_SURFACE_SAMPLES = 8
const MAX_FLOOR_Y_SPREAD_METERS = 0.12
const LOST_LIMITED_FRAMES = 10
const PROBE_X = 0.5
const PROBE_Y = 0.62

export type FloorPhase = 'searching' | 'candidate' | 'locked' | 'tracking-lost'

export interface FloorSnapshot {
  phase: FloorPhase
  trackingStatus: string
  trackingReason: string
  hitTypes: Record<string, number>
  consecutiveSurfaceSamples: number
  requiredSurfaceSamples: number
  floorY?: number
  ySpread?: number
  position?: [number, number, number]
}

export class FloorTrackingController {
  private frameCount = 0
  private limitedFrames = 0
  private trackingStatus = 'UNKNOWN'
  private trackingReason = 'UNSPECIFIED'
  private samples: THREE.Vector3[] = []
  private lockedPosition?: THREE.Vector3
  private snapshotValue: FloorSnapshot = this.createSnapshot('searching', {})

  constructor(
    private readonly xr8: XR8Api,
    private readonly store: AppStateStore,
    private readonly scene: PartitionScene,
    private readonly ui: UiController,
  ) {}

  update(reality?: RealityResult): void {
    if (!reality?.trackingStatus) return

    this.trackingStatus = reality.trackingStatus
    this.trackingReason = reality.trackingReason ?? 'UNSPECIFIED'

    if (this.trackingStatus !== 'NORMAL') {
      this.limitedFrames += 1
      if (this.limitedFrames >= LOST_LIMITED_FRAMES && this.snapshotValue.phase !== 'tracking-lost') {
        this.setPhase('tracking-lost', this.snapshotValue.hitTypes)
        this.scene.updateFloorMarker(this.lockedPosition, 'tracking-lost')
      }
      return
    }

    this.limitedFrames = 0
    if (this.lockedPosition) {
      if (this.snapshotValue.phase !== 'locked') {
        this.setPhase('locked', this.snapshotValue.hitTypes)
        this.scene.updateFloorMarker(this.lockedPosition, 'locked')
      }
      return
    }

    this.frameCount += 1
    if (this.frameCount % SAMPLE_INTERVAL_FRAMES !== 0) return
    this.probeFloor()
  }

  reset(): void {
    this.samples = []
    this.lockedPosition = undefined
    this.snapshotValue = this.createSnapshot('searching', {})
    this.scene.updateFloorMarker(undefined, 'searching')
    this.setStoreState('coaching')
    this.publish()
  }

  snapshot(): FloorSnapshot {
    return this.snapshotValue
  }

  private probeFloor(): void {
    // No includedTypes filter: collect every estimate so surface results are not discarded.
    const hits = this.xr8.XrController.hitTest(PROBE_X, PROBE_Y)
    const hitTypes = hits.reduce<Record<string, number>>((counts, hit) => {
      const type = hit.type ?? 'UNSPECIFIED'
      counts[type] = (counts[type] ?? 0) + 1
      return counts
    }, {})
    const surface = this.pickSurface(hits)

    if (!surface || !this.isUsable(surface)) {
      this.samples = []
      this.scene.updateFloorMarker(undefined, 'searching')
      this.setPhase('searching', hitTypes)
      return
    }

    const position = new THREE.Vector3(surface.position.x, surface.position.y, surface.position.z)
    this.samples.push(position)
    if (this.samples.length > REQUIRED_SURFACE_SAMPLES) this.samples.shift()

    const yValues = this.samples.map(sample => sample.y)
    const floorY = yValues.reduce((sum, value) => sum + value, 0) / yValues.length
    const ySpread = Math.max(...yValues) - Math.min(...yValues)
    this.scene.updateFloorMarker(position, 'candidate')

    if (this.samples.length >= REQUIRED_SURFACE_SAMPLES && ySpread <= MAX_FLOOR_Y_SPREAD_METERS) {
      this.lockedPosition = new THREE.Vector3(position.x, floorY, position.z)
      this.scene.updateFloorMarker(this.lockedPosition, 'locked')
      this.snapshotValue = {
        ...this.createSnapshot('locked', hitTypes),
        floorY,
        ySpread,
        position: this.lockedPosition.toArray(),
      }
      this.setStoreState('floor-locked')
      console.info('[floor] locked', this.snapshotValue)
      this.publish()
      return
    }

    this.snapshotValue = {
      ...this.createSnapshot('candidate', hitTypes),
      floorY,
      ySpread,
      position: position.toArray(),
    }
    this.setStoreState('floor-candidate')
    this.publish()
  }

  private pickSurface(hits: HitTestResult[]): HitTestResult | undefined {
    const byDistance = (a: HitTestResult, b: HitTestResult) =>
      (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)
    return (
      hits.filter(hit => hit.type === 'DETECTED_SURFACE').sort(byDistance)[0] ??
      hits.filter(hit => hit.type === 'ESTIMATED_SURFACE').sort(byDistance)[0]
    )
  }

  private isUsable(hit: HitTestResult): boolean {
    const {x, y, z} = hit.position
    return [x, y, z].every(Number.isFinite) && (hit.distance === undefined || (hit.distance > 0.2 && hit.distance < 8))
  }

  private setPhase(phase: FloorPhase, hitTypes: Record<string, number>): void {
    this.snapshotValue = {
      ...this.snapshotValue,
      ...this.createSnapshot(phase, hitTypes),
    }
    if (phase === 'searching') this.setStoreState('coaching')
    if (phase === 'candidate') this.setStoreState('floor-candidate')
    if (phase === 'locked') this.setStoreState('floor-locked')
    if (phase === 'tracking-lost') this.setStoreState('tracking-lost')
    this.publish()
  }

  private createSnapshot(phase: FloorPhase, hitTypes: Record<string, number>): FloorSnapshot {
    return {
      phase,
      trackingStatus: this.trackingStatus,
      trackingReason: this.trackingReason,
      hitTypes,
      consecutiveSurfaceSamples: this.samples.length,
      requiredSurfaceSamples: REQUIRED_SURFACE_SAMPLES,
    }
  }

  private setStoreState(state: 'coaching' | 'floor-candidate' | 'floor-locked' | 'tracking-lost'): void {
    if (this.store.current.state !== state) this.store.set(state)
  }

  private publish(): void {
    this.ui.setFloorFeedback(this.snapshotValue)
    this.ui.updateDebug({floor: this.snapshotValue})
  }
}
