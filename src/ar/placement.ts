import * as THREE from 'three'
import type {AppStateStore} from '../state/app-state'
import type {DebugView} from '../ui/ui'
import type {PartitionScene} from '../scene/scene'
import type {XR8Api} from './xr-types'

export interface PlacementSnapshot {
  hit: string
  position?: [number, number, number]
  yaw?: number
}

export class PlacementController {
  private inProgress = false
  private snapshotValue: PlacementSnapshot = {hit: 'not attempted'}

  constructor(
    private readonly xr8: XR8Api,
    private readonly canvas: HTMLCanvasElement,
    private readonly store: AppStateStore,
    private readonly scene: PartitionScene,
    private readonly showNotice: (message: string) => void,
    private readonly refreshDebug: () => void,
  ) {
    canvas.addEventListener('pointerup', this.onPointerUp)
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
  }

  reset(): void {
    this.scene.remove()
    this.snapshotValue = {hit: 'reset'}
    this.refreshDebug()
  }

  snapshot(): PlacementSnapshot {
    return this.snapshotValue
  }

  private readonly onPointerUp = async (event: PointerEvent): Promise<void> => {
    if (this.store.current.state !== 'ready-to-place' || this.inProgress) return
    if (event.button !== 0 && event.pointerType === 'mouse') return

    this.inProgress = true
    try {
      const rect = this.canvas.getBoundingClientRect()
      // Official API: normalized camera-feed coordinates in [0, 1], origin at top-left.
      const screenX = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1)
      const screenY = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height, 0, 1)
      const hits = this.xr8.XrController.hitTest(screenX, screenY, ['FEATURE_POINT'])

      if (!hits.length) {
        this.snapshotValue = {hit: `miss @ ${screenX.toFixed(3)}, ${screenY.toFixed(3)}`}
        console.info('[hitTest] miss', {screenX, screenY})
        this.showNotice('바닥이 잘 보이도록 천천히 움직인 뒤 다시 터치해 주세요.')
        return
      }

      const hit = hits.find(result => /GROUND|SURFACE/i.test(result.type ?? '')) ?? hits[0]
      const forward = this.scene.cameraForwardOnGround()
      if (!forward) throw new Error('카메라 방향을 계산할 수 없습니다.')

      // The partition's broad front face is +Z. Point it back toward the camera.
      const yaw = Math.atan2(-forward.x, -forward.z)
      const position = new THREE.Vector3(hit.position.x, 0, hit.position.z)
      const asset = await this.scene.place(position, yaw)

      this.snapshotValue = {
        hit: `success${hit.type ? ` (${hit.type})` : ''}`,
        position: [position.x, position.y, position.z],
        yaw,
      }
      console.info('[hitTest] success', {
        screen: [screenX, screenY],
        resultType: hit.type,
        rawPosition: hit.position,
        placementPosition: position.toArray(),
        yaw,
      })
      this.store.set('placed', {warning: asset.warning})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[placement] failed', error)
      this.snapshotValue = {hit: `error: ${message}`}
      this.showNotice(`배치하지 못했습니다. ${message}`)
    } finally {
      this.inProgress = false
      this.refreshDebug()
    }
  }
}

export function placementDebugView(snapshot: PlacementSnapshot): DebugView['placement'] {
  return snapshot
}
