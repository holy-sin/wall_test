import * as THREE from 'three'
import type {XR8Api} from '../ar/xr-types'
import {loadPartition, type PartitionLoadResult} from './partition'

interface LockedTransform {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

export class PartitionScene {
  private scene?: THREE.Scene
  private camera?: THREE.Camera
  private floorMarker?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private partition?: THREE.Group
  private partitionAsset?: Promise<PartitionLoadResult>
  private lockedTransform?: LockedTransform
  private invariantWarningSent = false
  private lastLoadResult?: PartitionLoadResult

  initialize(xr8: XR8Api): void {
    const {scene, camera, renderer} = xr8.Threejs.xrScene()
    this.scene = scene
    this.camera = camera
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true

    scene.add(new THREE.HemisphereLight(0xffffff, 0x52606d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(2, 4, 1)
    scene.add(keyLight)

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc978,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.floorMarker = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 64), markerMaterial)
    this.floorMarker.name = 'floor-diagnostic-marker'
    this.floorMarker.rotation.x = -Math.PI / 2
    this.floorMarker.visible = false
    this.floorMarker.renderOrder = 4
    scene.add(this.floorMarker)

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

  updateFloorMarker(
    position: THREE.Vector3 | undefined,
    phase: 'searching' | 'candidate' | 'locked' | 'tracking-lost',
  ): void {
    if (!this.floorMarker) return
    if (!position || phase === 'searching') {
      this.floorMarker.visible = false
      return
    }

    this.floorMarker.visible = true
    this.floorMarker.position.set(position.x, position.y + 0.012, position.z)
    if (phase === 'candidate') {
      this.floorMarker.material.color.setHex(0xffc978)
      this.floorMarker.material.opacity = 0.42
    } else if (phase === 'locked') {
      this.floorMarker.material.color.setHex(0x72f2a5)
      this.floorMarker.material.opacity = 0.96
    } else {
      this.floorMarker.material.color.setHex(0xff9b7a)
      this.floorMarker.material.opacity = 0.2
    }
    this.floorMarker.material.needsUpdate = true
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

  cameraPosition(): THREE.Vector3 | undefined {
    if (!this.camera) return undefined
    return this.camera.getWorldPosition(new THREE.Vector3())
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

  modelSnapshot(): {loaded: boolean; fallback?: boolean; warning?: string} {
    return {
      loaded: Boolean(this.lastLoadResult),
      fallback: this.lastLoadResult?.usedFallback,
      warning: this.lastLoadResult?.warning,
    }
  }
}
