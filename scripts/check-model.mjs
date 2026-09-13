import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modelPath = path.join(projectRoot, 'public', 'models', 'test_partition_1500x2300x100mm.glb')
const bytes = await readFile(modelPath)
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(arrayBuffer, '', resolve, reject)
})
const bounds = new THREE.Box3().setFromObject(gltf.scene)
const size = bounds.getSize(new THREE.Vector3())
const expected = new THREE.Vector3(1.5, 2.3, 0.1)
const tolerance = 0.005
const validSize = size.distanceTo(expected) <= tolerance
const validPivot = Math.abs(bounds.min.y) <= tolerance

console.log('GLB bounds:', {
  min: bounds.min.toArray(),
  max: bounds.max.toArray(),
  size: size.toArray(),
})

if (!validSize || !validPivot) {
  throw new Error(`Unexpected partition model bounds. Expected size ${expected.toArray()} and floor pivot Y=0.`)
}
