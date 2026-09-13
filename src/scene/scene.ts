import * as THREE from 'three'
import type {XR8Api} from '../ar/xr-types'
import {loadPartition, type PartitionLoadResult} from './partition'

interface LockedTransform {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

export interface SceneSnapshot {
  camera?: {
    position: [number, number, number]
    quaternion: [number, number, number, number]
    yaw: number
  }
  absoluteScaleMode: 'absolute'
  placementPlane: 'Y=0'
  partition: {
    loaded: boolean
    placed: boolean
    fallback?: boolean
    warning?: string
    position?: [number, number, number]
    yaw?: number
    scale?: [number, number, number]
  }
  transformLocked: boolean
}

export class PartitionScene {
  private scene?: THREE.Scene
  private camera?: THREE.Camera
  private groundPlane?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private partition?: THREE.Group
  private partitionAsset?: Promise<PartitionLoadResult>
  private lockedTransform?: LockedTransform
  private invariantWarningSent = false
  private lastLoadResult?: PartitionLoadResult
  private readonly raycaster = new THREE.Raycaster()

  initialize(xr8: XR8Api, debug: boolean): void {
    const {scene, camera, renderer} = xr8.Threejs.xrScene()
    this.scene = scene
    this.camera = camera
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true

    scene.add(new THREE.HemisphereLight(0xffffff, 0x52606d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(2, 4, 1)
    scene.add(keyLight)

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x72f2a5,
      transparent: true,
      opacity: debug ? 0.12 : 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), planeMaterial)
    this.groundPlane.name = 'placement-ground-y0'
    this.groundPlane.rotation.x = -Math.PI / 2
    this.groundPlane.position.set(0, 0, 0)
    this.groundPlane.updateMatrixWorld(true)
    scene.add(this.groundPlane)

    if (debug) {
      const grid = new THREE.GridHelper(20, 40, 0x72f2a5, 0x3e6d50)
      grid.name = 'debug-ground-grid-y0'
      grid.position.y = 0.006
      scene.add(grid)
    }

    // Official 8th Wall Three.js setup: initialize above Y=0 and sync the XR camera.
    camera.position.set(0, 2, 2)
    xr8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })
    console.info('[xr] camera projection synchronized', {
      origin: camera.position.toArray(),
      facing: camera.quaternion.toArray(),
    })

    this.partitionAsset = loadPartition()
    void this.partitionAsset.then(result => {
      this.lastLoadResult = result
      console.info('[model]', result.usedFallback ? 'fallback ready' : 'GLB ready', {
        dimensions: result.measuredSize.toArray(),
        warning: result.warning,
      })
    })
  }

  hasPlacement = (): boolean => Boolean(this.partition)

  intersectGround(pointerNdc: THREE.Vector2): THREE.Vector3 | undefined {
    if (!this.camera || !this.groundPlane) return undefined
    this.camera.updateMatrixWorld(true)
    this.groundPlane.updateMatrixWorld(true)
    this.raycaster.setFromCamera(pointerNdc, this.camera)
    return this.raycaster.intersectObject(this.groundPlane, false)[0]?.point.clone()
  }

  async place(position: THREE.Vector3, yaw: number): Promise<PartitionLoadResult> {
    if (!this.scene || !this.partitionAsset) throw new Error('Three.js 장면이 아직 준비되지 않았습니다.')
    if (this.partition) throw new Error('가벽은 동시에 하나만 배치할 수 있습니다.')

    const asset = await this.partitionAsset
    this.partition = asset.object
    this.partition.position.set(position.x, 0, position.z)
    this.partition.rotation.set(0, yaw, 0)
    this.partition.updateMatrixWorld(true)
    this.scene.add(this.partition)

    this.lockedTransform = {
      position: this.partition.position.clone(),
      quaternion: this.partition.quaternion.clone(),
      scale: this.partition.scale.clone(),
    }
    this.invariantWarningSent = false
    console.info('[placement] world transform locked', {
      position: this.partition.position.toArray(),
      yaw,
      quaternion: this.partition.quaternion.toArray(),
      scale: this.partition.scale.toArray(),
    })
    return asset
  }

  remove(): void {
    if (this.partition && this.scene) this.scene.remove(this.partition)
    this.partition = undefined
    this.lockedTransform = undefined
    this.invariantWarningSent = false
    console.info('[placement] partition removed')
  }

  cameraForwardOnGround(): THREE.Vector3 | undefined {
    if (!this.camera) return undefined
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-8) return undefined
    return forward.normalize()
  }

  verifyLockedTransform(): boolean {
    if (!this.partition || !this.lockedTransform) return true
    const unchanged =
      this.partition.position.equals(this.lockedTransform.position) &&
      this.partition.quaternion.equals(this.lockedTransform.quaternion) &&
      this.partition.scale.equals(this.lockedTransform.scale)
    if (!unchanged && !this.invariantWarningSent) {
      this.invariantWarningSent = true
      console.error('[placement] invariant violated: partition transform changed after placement')
    }
    return unchanged
  }

  snapshot(): SceneSnapshot {
    const cameraPosition = this.camera?.getWorldPosition(new THREE.Vector3())
    const cameraQuaternion = this.camera?.getWorldQuaternion(new THREE.Quaternion())
    const cameraEuler = cameraQuaternion ? new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ') : undefined
    return {
      camera: cameraPosition && cameraQuaternion && cameraEuler
        ? {
            position: cameraPosition.toArray(),
            quaternion: cameraQuaternion.toArray(),
            yaw: cameraEuler.y,
          }
        : undefined,
      absoluteScaleMode: 'absolute',
      placementPlane: 'Y=0',
      partition: {
        loaded: Boolean(this.lastLoadResult),
        placed: Boolean(this.partition),
        fallback: this.lastLoadResult?.usedFallback,
        warning: this.lastLoadResult?.warning,
        position: this.partition?.position.toArray(),
        yaw: this.partition?.rotation.y,
        scale: this.partition?.scale.toArray(),
      },
      transformLocked: this.verifyLockedTransform(),
    }
  }
}
