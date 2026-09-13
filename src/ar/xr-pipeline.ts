import type {AppStateStore} from '../state/app-state'
import type {PartitionScene} from '../scene/scene'
import type {UiController} from '../ui/ui'
import type {CameraPipelineModule, XR8Api} from './xr-types'
import type {FloorTrackingController} from './floor-tracking'

export function createPartitionPipelineModule(options: {
  xr8: XR8Api
  store: AppStateStore
  scene: PartitionScene
  floorTracking: FloorTrackingController
  ui: UiController
}): CameraPipelineModule {
  const {xr8, store, scene, floorTracking, ui} = options
  let frameCount = 0

  return {
    name: 'ar-partition-placement',
    onStart: () => {
      store.set('coaching')
      floorTracking.reset()
      scene.initialize(xr8)
      ui.updateDebug({floor: floorTracking.snapshot(), scene: scene.modelSnapshot()})
    },
    onUpdate: ({processCpuResult}) => {
      floorTracking.update(processCpuResult?.reality)
      frameCount += 1
      if (frameCount % 30 === 0) {
        const camera = scene.cameraPosition()
        ui.updateDebug({
          floor: floorTracking.snapshot(),
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
      const startupState = ['idle', 'requesting-camera', 'initializing'].includes(store.current.state)
      if (status === 'requesting' && startupState) store.set('requesting-camera')
      if (status === 'hasStream' && startupState) store.set('initializing')
      if (status === 'hasVideo' && startupState) store.set('coaching')
      if (status === 'failed') {
        store.set('error', {
          message: '카메라 권한이 거부되었거나 카메라를 열 수 없습니다. 브라우저 설정에서 카메라 권한을 허용해 주세요.',
        })
      }
    },
  }
}
