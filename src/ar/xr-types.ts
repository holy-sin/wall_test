import type * as THREE from 'three'

export interface XrVector3 {
  x: number
  y: number
  z: number
}

export interface XrQuaternion extends XrVector3 {
  w: number
}

export interface RealityResult {
  position?: XrVector3
  rotation?: XrQuaternion
  trackingStatus?: 'NORMAL' | 'LIMITED'
  trackingReason?: string
}

export interface PipelineUpdateArgs {
  processCpuResult?: {
    reality?: RealityResult
  }
}

export interface PipelineStartArgs {
  canvas: HTMLCanvasElement
  canvasWidth: number
  canvasHeight: number
}

export interface CameraStatusArgs {
  status: 'requesting' | 'hasStream' | 'hasVideo' | 'failed'
}

export interface CameraPipelineModule {
  name: string
  onStart?: (args: PipelineStartArgs) => void | Promise<void>
  onUpdate?: (args: PipelineUpdateArgs) => void
  onCameraStatusChange?: (args: CameraStatusArgs) => void
  onDetach?: () => void
}

export interface XR8Api {
  GlTextureRenderer: {pipelineModule(): CameraPipelineModule}
  Threejs: {
    pipelineModule(): CameraPipelineModule
    xrScene(): {
      scene: THREE.Scene
      camera: THREE.Camera
      renderer: THREE.WebGLRenderer
    }
  }
  XrController: {
    configure(options: {disableWorldTracking: boolean; scale: 'absolute' | 'responsive'}): void
    pipelineModule(): CameraPipelineModule
    updateCameraProjectionMatrix(options: {origin: THREE.Vector3; facing: THREE.Quaternion}): void
  }
  XrConfig: {
    camera(): {BACK: unknown; FRONT: unknown}
    device(): {MOBILE: unknown; ANY: unknown}
  }
  XrDevice?: {
    isDeviceBrowserCompatible(options?: {allowedDevices?: unknown}): boolean
    incompatibleReasons(options?: {allowedDevices?: unknown}): unknown[]
  }
  addCameraPipelineModules(modules: CameraPipelineModule[]): void
  run(options: {canvas: HTMLCanvasElement; cameraConfig?: {direction: unknown}; allowedDevices?: unknown}): void
}

export interface XRExtrasApi {
  FullWindowCanvas: {pipelineModule(): CameraPipelineModule}
}

declare global {
  interface Window {
    XR8?: XR8Api
    XRExtras?: XRExtrasApi
    THREE: typeof THREE
  }
}
