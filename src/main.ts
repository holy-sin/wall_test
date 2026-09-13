import * as THREE from 'three'
import './styles.css'
import {FloorTrackingController} from './ar/floor-tracking'
import {createPartitionPipelineModule} from './ar/xr-pipeline'
import {ensureSupported, loadXrEngine, startXr} from './ar/xr-engine'
import {AppStateStore} from './state/app-state'
import {PartitionScene} from './scene/scene'
import {UiController} from './ui/ui'

window.THREE = THREE

function requireCanvas(): HTMLCanvasElement {
  const found = document.getElementById('camerafeed')
  if (!(found instanceof HTMLCanvasElement)) throw new Error('AR canvas를 찾을 수 없습니다.')
  return found
}

const canvas = requireCanvas()

const store = new AppStateStore()
const ui = new UiController(store)
const partitionScene = new PartitionScene()
let floorTracking: FloorTrackingController | undefined
let startAttempted = false

async function beginAr(): Promise<void> {
  if (startAttempted) return
  startAttempted = true
  store.set('requesting-camera')

  try {
    const xr8 = await loadXrEngine()
    ensureSupported(xr8)
    store.set('initializing')
    floorTracking = new FloorTrackingController(xr8, store, partitionScene, ui)

    const pipeline = createPartitionPipelineModule({
      xr8,
      store,
      scene: partitionScene,
      floorTracking,
      ui,
    })

    startXr(xr8, canvas, pipeline)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[startup] failed', error)
    store.set('error', {message})
  }
}

ui.startButton.addEventListener('click', () => void beginAr())
ui.replaceButton.addEventListener('click', event => {
  event.stopPropagation()
  floorTracking?.reset()
})
ui.retryButton.addEventListener('click', () => location.reload())

window.addEventListener('error', event => {
  console.error('[window error]', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', event => {
  console.error('[unhandled rejection]', event.reason)
})
