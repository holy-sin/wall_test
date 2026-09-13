import {XR8Promise} from '@8thwall/engine-binary'
import type {XR8Api} from './xr-types'

const ENGINE_TIMEOUT_MS = 20_000

export async function loadXrEngine(): Promise<XR8Api> {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('8th Wall 엔진 로딩 시간이 초과되었습니다.')), ENGINE_TIMEOUT_MS)
  })
  const xr8 = await Promise.race([XR8Promise, timeout])
  return xr8 as XR8Api
}

export function ensureSupported(xr8: XR8Api): void {
  if (!window.isSecureContext) {
    throw new Error('카메라 AR은 HTTPS 연결에서만 사용할 수 있습니다.')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.')
  }

  const allowedDevices = xr8.XrConfig.device().MOBILE
  if (xr8.XrDevice && !xr8.XrDevice.isDeviceBrowserCompatible({allowedDevices})) {
    const reasons = xr8.XrDevice.incompatibleReasons({allowedDevices})
    throw new Error(`지원되지 않는 기기 또는 브라우저입니다. (${reasons.join(', ') || '호환성 확인 실패'})`)
  }
}

export function startXr(xr8: XR8Api, canvas: HTMLCanvasElement, customModule: CameraPipelineModule): void {
  const xrExtras = window.XRExtras
  if (!xrExtras) throw new Error('XRExtras를 불러오지 못했습니다.')

  xr8.XrController.configure({
    disableWorldTracking: false,
    scale: 'absolute',
  })
  console.info('[xr] configured', {disableWorldTracking: false, scale: 'absolute'})

  xr8.addCameraPipelineModules([
    xr8.GlTextureRenderer.pipelineModule(),
    xr8.Threejs.pipelineModule(),
    xr8.XrController.pipelineModule(),
    xrExtras.FullWindowCanvas.pipelineModule(),
    customModule,
  ])

  xr8.run({
    canvas,
    cameraConfig: {direction: xr8.XrConfig.camera().BACK},
    allowedDevices: xr8.XrConfig.device().MOBILE,
  })
}

import type {CameraPipelineModule} from './xr-types'
