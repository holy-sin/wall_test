import type {AppSnapshot, AppStateStore} from '../state/app-state'
import type {PlacementSnapshot} from '../ar/placement'
import type {TrackingSnapshot} from '../ar/tracking'
import type {SceneSnapshot} from '../scene/scene'

export interface DebugView {
  AppState?: string
  trackingStatus?: string | null
  trackingReason?: string | null
  trackingNormalFrames?: number | null
  trackingLimitedFrames?: number | null
  trackingPosition?: [number, number, number] | null
  trackingRotation?: [number, number, number, number] | null
  camera?: [number, number, number] | null
  cameraQuaternion?: [number, number, number, number] | null
  cameraYaw?: number | null
  absoluteScaleMode?: 'absolute'
  placementPlane?: 'Y=0'
  lastPointerNDC?: [number, number] | null
  lastIntersection?: [number, number, number] | null
  placementResult?: string | null
  partitionLoaded?: boolean
  partitionPlaced?: boolean
  partitionPosition?: [number, number, number] | null
  partitionYaw?: number | null
  partitionScale?: [number, number, number] | null
  partitionFallback?: boolean | null
  partitionWarning?: string | null
  transformLocked?: boolean
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`필수 UI 요소를 찾을 수 없습니다: #${id}`)
  return found as T
}

export class UiController {
  readonly startButton = element<HTMLButtonElement>('start-button')
  readonly replaceButton = element<HTMLButtonElement>('replace-button')
  readonly retryButton = element<HTMLButtonElement>('retry-button')

  private readonly intro = element<HTMLElement>('intro')
  private readonly statusCard = element<HTMLElement>('status-card')
  private readonly statusIcon = element<HTMLElement>('status-icon')
  private readonly statusMessage = element<HTMLElement>('status-message')
  private readonly errorPanel = element<HTMLElement>('error-panel')
  private readonly errorMessage = element<HTMLElement>('error-message')
  private readonly reticle = element<HTMLElement>('reticle')
  private readonly debugPanel = element<HTMLElement>('debug-panel')
  private debugView: DebugView = {}
  private noticeTimer?: number

  constructor(private readonly store: AppStateStore) {
    this.debugPanel.hidden = new URLSearchParams(location.search).get('debug') !== '1'
    store.subscribe(snapshot => this.render(snapshot))
  }

  showNotice(message: string): void {
    window.clearTimeout(this.noticeTimer)
    this.statusCard.hidden = false
    this.statusIcon.className = 'status-icon warning'
    this.statusMessage.textContent = message
    this.noticeTimer = window.setTimeout(() => this.render(this.store.current), 2600)
  }

  updateDebug(partial: DebugView): void {
    this.debugView = {...this.debugView, ...partial, AppState: this.store.current.state}
    if (!this.debugPanel.hidden) this.debugPanel.textContent = JSON.stringify(this.debugView, null, 2)
  }

  updateRuntimeDebug(
    tracking: TrackingSnapshot | undefined,
    placement: PlacementSnapshot | undefined,
    scene: SceneSnapshot,
  ): void {
    this.updateDebug({
      trackingStatus: tracking?.status ?? null,
      trackingReason: tracking?.reason ?? null,
      trackingNormalFrames: tracking?.normalFrames ?? null,
      trackingLimitedFrames: tracking?.limitedFrames ?? null,
      trackingPosition: tracking?.position ?? null,
      trackingRotation: tracking?.rotation ?? null,
      camera: scene.camera?.position ?? null,
      cameraQuaternion: scene.camera?.quaternion ?? null,
      cameraYaw: scene.camera?.yaw ?? null,
      absoluteScaleMode: scene.absoluteScaleMode,
      placementPlane: scene.placementPlane,
      lastPointerNDC: placement?.lastPointerNdc ?? null,
      lastIntersection: placement?.lastIntersection ?? null,
      placementResult: placement?.result ?? null,
      partitionLoaded: scene.partition.loaded,
      partitionPlaced: scene.partition.placed,
      partitionPosition: scene.partition.position ?? null,
      partitionYaw: scene.partition.yaw ?? null,
      partitionScale: scene.partition.scale ?? null,
      partitionFallback: scene.partition.fallback ?? null,
      partitionWarning: scene.partition.warning ?? null,
      transformLocked: scene.transformLocked,
    })
  }

  private render(snapshot: AppSnapshot): void {
    window.clearTimeout(this.noticeTimer)
    this.intro.hidden = snapshot.state !== 'idle'
    this.errorPanel.hidden = snapshot.state !== 'error'
    this.replaceButton.hidden = snapshot.state !== 'placed'
    this.reticle.hidden = snapshot.state !== 'ready-to-place'
    this.statusCard.hidden = ['idle', 'error'].includes(snapshot.state)
    this.startButton.disabled = snapshot.state !== 'idle'

    if (snapshot.state === 'error') {
      this.errorMessage.textContent = snapshot.message ?? '알 수 없는 오류가 발생했습니다.'
    }

    const content: Partial<Record<typeof snapshot.state, [string, string]>> = {
      'requesting-camera': ['pulse', '카메라 권한을 확인하고 있습니다…'],
      initializing: ['pulse', 'AR 엔진을 준비하고 있습니다…'],
      coaching: ['motion', '공간 추적을 준비 중입니다. 휴대폰을 천천히 움직여 주세요.'],
      'ready-to-place': ['ready', '준비되었습니다. 가벽을 놓을 바닥을 터치하세요.'],
      placed: ['ready', '가벽을 배치했습니다. 움직이며 같은 위치에 고정되는지 확인하세요.'],
      'tracking-lost': ['warning', '공간 추적이 약해졌습니다. 휴대폰을 천천히 주변으로 움직여 주세요.'],
    }
    const selected = content[snapshot.state]
    if (selected) {
      this.statusIcon.className = `status-icon ${selected[0]}`
      this.statusMessage.textContent = selected[1]
    }

    this.updateDebug({AppState: snapshot.state})
  }
}
