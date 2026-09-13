import type {AppSnapshot, AppStateStore} from '../state/app-state'
import type {PlacementSnapshot} from '../ar/placement'
import type {TrackingSnapshot} from '../ar/tracking'
import type {FloorSnapshot} from '../ar/floor-tracking'

export interface DebugView {
  state?: string
  tracking?: TrackingSnapshot
  floor?: FloorSnapshot
  camera?: number[]
  placement?: PlacementSnapshot
  scene?: {
    loaded: boolean
    fallback?: boolean
    warning?: string
    transformLocked?: boolean
  }
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
    this.debugView = {...this.debugView, ...partial, state: this.store.current.state}
    if (!this.debugPanel.hidden) this.debugPanel.textContent = JSON.stringify(this.debugView, null, 2)
  }

  setFloorFeedback(snapshot: FloorSnapshot): void {
    const progress = Math.min(1, snapshot.consecutiveSurfaceSamples / snapshot.requiredSurfaceSamples)
    this.reticle.dataset.phase = snapshot.phase
    this.reticle.style.setProperty('--floor-progress', String(progress))
    this.reticle.style.opacity = snapshot.phase === 'candidate' ? String(0.38 + progress * 0.46) : ''
  }

  private render(snapshot: AppSnapshot): void {
    window.clearTimeout(this.noticeTimer)
    this.intro.hidden = snapshot.state !== 'idle'
    this.errorPanel.hidden = snapshot.state !== 'error'
    this.replaceButton.hidden = !['floor-locked', 'placed'].includes(snapshot.state)
    this.reticle.hidden = !['coaching', 'floor-candidate', 'floor-locked', 'tracking-lost'].includes(snapshot.state)
    this.statusCard.hidden = ['idle', 'error'].includes(snapshot.state)
    this.startButton.disabled = snapshot.state !== 'idle'

    if (snapshot.state === 'error') {
      this.errorMessage.textContent = snapshot.message ?? '알 수 없는 오류가 발생했습니다.'
    }

    const content: Partial<Record<typeof snapshot.state, [string, string]>> = {
      'requesting-camera': ['pulse', '카메라 권한을 확인하고 있습니다…'],
      initializing: ['pulse', 'AR 엔진을 준비하고 있습니다…'],
      coaching: ['motion', '바닥을 화면 중앙에 두고 휴대폰을 천천히 움직여 주세요.'],
      'floor-candidate': ['warning', '바닥 후보를 확인하고 있습니다. 잠시만 천천히 움직여 주세요.'],
      'floor-locked': ['ready', '바닥 인식 완료. 초록 원이 같은 위치에 고정되는지 확인하세요.'],
      'ready-to-place': ['ready', '가벽을 놓을 바닥을 터치하세요.'],
      'tracking-lost': ['warning', '공간 추적이 약해졌습니다. 휴대폰을 천천히 주변으로 움직여 주세요.'],
    }
    const selected = content[snapshot.state]
    if (selected) {
      this.statusIcon.className = `status-icon ${selected[0]}`
      this.statusMessage.textContent = selected[1]
    }

    if (snapshot.state === 'coaching') this.reticle.dataset.phase = 'searching'
    if (snapshot.state === 'floor-candidate') this.reticle.dataset.phase = 'candidate'
    if (snapshot.state === 'floor-locked') this.reticle.dataset.phase = 'locked'
    if (snapshot.state === 'tracking-lost') this.reticle.dataset.phase = 'tracking-lost'

    this.updateDebug({state: snapshot.state})
  }
}
