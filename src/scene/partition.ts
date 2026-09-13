import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

const EXPECTED_SIZE = new THREE.Vector3(1.5, 2.3, 0.1)
const DIMENSION_TOLERANCE_METERS = 0.005

export interface PartitionLoadResult {
  object: THREE.Group
  usedFallback: boolean
  measuredSize: THREE.Vector3
  warning?: string
}

function createFallback(): PartitionLoadResult {
  const geometry = new THREE.BoxGeometry(1.5, 2.3, 0.1)
  geometry.translate(0, 1.15, 0)
  const material = new THREE.MeshStandardMaterial({
    color: 0xe8e3d9,
    roughness: 0.82,
    metalness: 0.03,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const root = new THREE.Group()
  root.name = 'partition-fallback-1500x2300x100mm'
  root.add(mesh)
  return {
    object: root,
    usedFallback: true,
    measuredSize: EXPECTED_SIZE.clone(),
    warning: 'GLB를 불러오지 못해 동일 규격의 임시 박스를 사용합니다.',
  }
}

function loadGltf(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      gltf => resolve(gltf.scene),
      undefined,
      reject,
    )
  })
}

export async function loadPartition(url = '/models/test_partition_1500x2300x100mm.glb'): Promise<PartitionLoadResult> {
  try {
    const model = await loadGltf(url)
    model.name = 'partition-1500x2300x100mm'
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    const dimensionsValid =
      Math.abs(size.x - EXPECTED_SIZE.x) <= DIMENSION_TOLERANCE_METERS &&
      Math.abs(size.y - EXPECTED_SIZE.y) <= DIMENSION_TOLERANCE_METERS &&
      Math.abs(size.z - EXPECTED_SIZE.z) <= DIMENSION_TOLERANCE_METERS
    const pivotValid = Math.abs(bounds.min.y) <= DIMENSION_TOLERANCE_METERS

    const warnings: string[] = []
    if (!dimensionsValid) {
      warnings.push(`GLB 치수 ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}m (예상 1.500 × 2.300 × 0.100m)`)
    }
    if (!pivotValid) warnings.push(`GLB 바닥 기준점이 Y=${bounds.min.y.toFixed(3)}m 입니다.`)

    console.info('[model] GLB loaded', {
      size: size.toArray(),
      boundsMin: bounds.min.toArray(),
      boundsMax: bounds.max.toArray(),
      scale: model.scale.toArray(),
    })

    return {
      object: model,
      usedFallback: false,
      measuredSize: size,
      warning: warnings.length ? warnings.join(' / ') : undefined,
    }
  } catch (error) {
    console.warn('[model] GLB load failed; using fallback geometry', error)
    return createFallback()
  }
}
