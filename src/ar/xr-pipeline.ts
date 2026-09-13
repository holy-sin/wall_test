import type {AppStateStore} from '../state/app-state'
import type {PartitionScene} from '../scene/scene'
import type {UiController} from '../ui/ui'
import type {PlacementController} from './placement'
import type {TrackingController} from './tracking'
import type {CameraPipelineModule, XR8Api} from './xr-types'

export function createPartitionPipelineModule(options: {
  xr8: XR8Api
  store: AppStateStore
  scene: PartitionScene
  tracking: TrackingController
  placement: PlacementController
  ui: UiController
  debug: boolean
}): CameraPipelineModule {
  const {xr8, store, scene, tracking, placement, ui, debug} = options
  let frameCount = 0

  const refreshDebug = (): void => {
    ui.updateRuntimeDebug(tracking.snapshot(), placement.snapshot(), scene.snapshot())
  }

  return {
    name: 'ar-partition-placement',
    onStart: () => {
      scene.initialize(xr8, debug)
      store.set('coaching')
      refreshDebug()
    },
    onUpdate: ({processCpuResult}) => {
      tracking.update(processCpuResult?.reality)
      frameCount += 1
      if (frameCount % 15 === 0) refreshDebug()
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
    onDetach: () => placement.destroy(),
  }
}
