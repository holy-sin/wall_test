import * as THREE from 'three'
import type {AppStateStore} from '../state/app-state'
import type {PartitionScene} from '../scene/scene'

export interface PlacementSnapshot {
  result: string
  lastPointerNdc?: [number, number]
  lastIntersection?: [number, number, number]
}

export class PlacementController {
  private inProgress = false
  private snapshotValue: PlacementSnapshot = {result: 'not attempted'}

  constructor(
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
    this.snapshotValue = {result: 'reset'}
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
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      pointer.clampScalar(-1, 1)
      const intersection = this.scene.intersectGround(pointer)

      if (!intersection) {
        this.snapshotValue = {
          result: 'ray missed Y=0 plane',
          lastPointerNdc: [pointer.x, pointer.y],
        }
        console.info('[placement] ray missed Y=0 plane', {pointerNdc: pointer.toArray()})
        this.showNotice('화면 아래쪽의 바닥을 터치해 주세요.')
        return
      }

      const forward = this.scene.cameraForwardOnGround()
      if (!forward) throw new Error('카메라 방향을 계산할 수 없습니다.')

      // The partition's broad front face is +Z. Point it back toward the camera.
      const yaw = Math.atan2(-forward.x, -forward.z)
      const position = new THREE.Vector3(intersection.x, 0, intersection.z)
      const asset = await this.scene.place(position, yaw)

      this.snapshotValue = {
        result: 'placed on Y=0 plane',
        lastPointerNdc: [pointer.x, pointer.y],
        lastIntersection: [position.x, position.y, position.z],
      }
      console.info('[placement] success', {
        pointerNdc: pointer.toArray(),
        intersection: position.toArray(),
        yaw,
      })
      this.store.set('placed', {warning: asset.warning})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[placement] failed', error)
      this.snapshotValue = {...this.snapshotValue, result: `error: ${message}`}
      this.showNotice(`배치하지 못했습니다. ${message}`)
    } finally {
      this.inProgress = false
      this.refreshDebug()
    }
  }
}
