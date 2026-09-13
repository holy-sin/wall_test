import * as THREE from 'three'
import './styles.css'
import {PlacementController} from './ar/placement'
import {createPartitionPipelineModule} from './ar/xr-pipeline'
import {ensureSupported, loadXrEngine, startXr} from './ar/xr-engine'
import {TrackingController} from './ar/tracking'
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
const tracking = new TrackingController(store, partitionScene.hasPlacement)
let placement: PlacementController | undefined
let startAttempted = false

async function beginAr(): Promise<void> {
  if (startAttempted) return
  startAttempted = true
  store.set('requesting-camera')

  try {
    const xr8 = await loadXrEngine()
    ensureSupported(xr8)
    store.set('initializing')

    const pipeline = createPartitionPipelineModule({
      xr8,
      store,
      scene: partitionScene,
      tracking,
      ui,
      onSceneReady: readyCanvas => {
        placement?.destroy()
        placement = new PlacementController(
          xr8,
          readyCanvas,
          store,
          partitionScene,
          message => ui.showNotice(message),
          () => ui.updateDebug({placement: placement?.snapshot()}),
        )
      },
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
  placement?.reset()
  tracking.resetForPlacement()
})
ui.retryButton.addEventListener('click', () => location.reload())

window.addEventListener('error', event => {
  console.error('[window error]', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', event => {
  console.error('[unhandled rejection]', event.reason)
})
