import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
import * as THREE from 'three'

async function importTranspiled(file, transform = source => source) {
  const source = transform(await readFile(file, 'utf8'))
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

function createStore(initialState) {
  const transitions = []
  return {
    transitions,
    current: {state: initialState},
    set(state, details = {}) {
      this.current = {state, ...details}
      transitions.push(state)
    },
  }
}

async function verifyTrackingController() {
  const module = await importTranspiled(new URL('../src/ar/tracking.ts', import.meta.url))
  const store = createStore('coaching')
  let hasPlacement = false
  const tracking = new module.TrackingController(store, () => hasPlacement)
  const normal = {
    trackingStatus: 'NORMAL',
    trackingReason: 'NONE',
    position: {x: 1, y: 2, z: 3},
    rotation: {x: 0, y: 0, z: 0, w: 1},
  }

  for (let i = 0; i < 23; i += 1) tracking.update(normal)
  assert.equal(store.current.state, 'coaching', '23 NORMAL frames must still be coaching')
  tracking.update(normal)
  assert.equal(store.current.state, 'ready-to-place', '24 NORMAL frames must enable placement')

  for (let i = 0; i < 9; i += 1) tracking.update({trackingStatus: 'LIMITED', trackingReason: 'LOW_FEATURES'})
  assert.equal(store.current.state, 'ready-to-place', '9 LIMITED frames must not drop tracking yet')
  tracking.update({trackingStatus: 'LIMITED', trackingReason: 'LOW_FEATURES'})
  assert.equal(store.current.state, 'tracking-lost', '10 LIMITED frames must report tracking loss')

  hasPlacement = true
  for (let i = 0; i < 24; i += 1) tracking.update(normal)
  assert.equal(store.current.state, 'placed', 'tracking recovery must preserve an existing placement')
  assert.deepEqual(tracking.snapshot().position, [1, 2, 3])
}

async function verifyPlacementController() {
  globalThis.__AR_TEST_THREE__ = THREE
  const module = await importTranspiled(
    new URL('../src/ar/placement.ts', import.meta.url),
    source => source.replace("import * as THREE from 'three'", 'const THREE = globalThis.__AR_TEST_THREE__'),
  )
  const store = createStore('ready-to-place')
  let pointerHandler
  let removed = false
  const canvas = {
    addEventListener(type, handler) {
      if (type === 'pointerup') pointerHandler = handler
    },
    removeEventListener(type, handler) {
      if (type === 'pointerup' && pointerHandler === handler) removed = true
    },
    getBoundingClientRect() {
      return {left: 0, top: 0, width: 200, height: 400}
    },
  }
  let placeCalls = 0
  let placedPosition
  let placedYaw
  let removeCalls = 0
  const scene = {
    intersectGround(pointer) {
      assert.deepEqual(pointer.toArray(), [0, -0.5])
      return new THREE.Vector3(2, 0, -3)
    },
    cameraForwardOnGround() {
      return new THREE.Vector3(0, 0, -1)
    },
    async place(position, yaw) {
      placeCalls += 1
      placedPosition = position.toArray()
      placedYaw = yaw
      return {}
    },
    remove() {
      removeCalls += 1
    },
  }
  const placement = new module.PlacementController(canvas, store, scene, () => {}, () => {})

  await pointerHandler({clientX: 100, clientY: 300, button: 0, pointerType: 'touch'})
  assert.equal(placeCalls, 1)
  assert.deepEqual(placedPosition, [2, 0, -3])
  assert.ok(Math.abs(placedYaw) < 1e-12)
  assert.equal(store.current.state, 'placed')
  assert.deepEqual(placement.snapshot().lastPointerNdc, [0, -0.5])
  assert.deepEqual(placement.snapshot().lastIntersection, [2, 0, -3])

  await pointerHandler({clientX: 100, clientY: 300, button: 0, pointerType: 'touch'})
  assert.equal(placeCalls, 1, 'a second pointer must not create another partition')
  placement.reset()
  assert.equal(removeCalls, 1)
  placement.destroy()
  assert.equal(removed, true)
}

function verifyGroundRaycast() {
  const camera = new THREE.PerspectiveCamera(60, 0.5, 0.01, 100)
  camera.position.set(0, 2, 2)
  camera.lookAt(0, 0, -2)
  camera.updateMatrixWorld(true)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100))
  plane.rotation.x = -Math.PI / 2
  plane.updateMatrixWorld(true)
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
  const point = raycaster.intersectObject(plane)[0]?.point
  assert.ok(point, 'downward camera ray must intersect the Y=0 plane')
  assert.ok(Math.abs(point.y) < 1e-8, 'ground intersection must remain at Y=0')
}

await verifyTrackingController()
await verifyPlacementController()
verifyGroundRaycast()
console.info('Controller verification passed: tracking, Y=0 raycast, placement lock, reset')
