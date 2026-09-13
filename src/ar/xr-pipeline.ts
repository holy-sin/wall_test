import type {AppStateStore} from '../state/app-state'
import type {PartitionScene} from '../scene/scene'
import type {UiController} from '../ui/ui'
import type {CameraPipelineModule, XR8Api} from './xr-types'
import type {TrackingController} from './tracking'

export function createPartitionPipelineModule(options: {
  xr8: XR8Api
  store: AppStateStore
  scene: PartitionScene
  tracking: TrackingController
  ui: UiController
  onSceneReady: (canvas: HTMLCanvasElement) => void
}): CameraPipelineModule {
  const {xr8, store, scene, tracking, ui, onSceneReady} = options
  let frameCount = 0

  return {
    name: 'ar-partition-placement',
    onStart: ({canvas}) => {
      scene.initialize(xr8)
      onSceneReady(canvas)
      store.set('coaching')
      ui.updateDebug({tracking: tracking.snapshot(), scene: scene.modelSnapshot()})
    },
    onUpdate: ({processCpuResult}) => {
      tracking.update(processCpuResult?.reality)
      frameCount += 1
      if (frameCount % 30 === 0) {
        const camera = scene.cameraPosition()
        ui.updateDebug({
          tracking: tracking.snapshot(),
          camera: camera?.toArray(),
          scene: {
            ...scene.modelSnapshot(),
            transformLocked: scene.verifyLockedTransform(),
          },
        })
      }
    },
    onCameraStatusChange: ({status}) => {
      console.info('[camera]', status)
      if (status === 'requesting') store.set('requesting-camera')
      if (status === 'hasStream') store.set('initializing')
      if (status === 'failed') {
        store.set('error', {
          message: '카메라 권한이 거부되었거나 카메라를 열 수 없습니다. 브라우저 설정에서 카메라 권한을 허용해 주세요.',
        })
      }
    },
  }
}
