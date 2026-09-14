// Component that places one partition where the ground is clicked.

export const tapPlaceComponent = {
  init() {
    const ground = document.getElementById('ground')
    const camera = document.getElementById('camera')
    this.prompt = document.getElementById('promptText')
    this.partition = null
    this.cameraPosition = new THREE.Vector3()

    ground.addEventListener('click', (event) => {
      // The raycaster gives a location of the touch in the scene
      const touchPoint = event.detail.intersection.point

      if (!this.partition) {
        this.partition = document.createElement('a-entity')
        this.partition.setAttribute('id', 'partition')
        this.partition.setAttribute('geometry', {
          primitive: 'box',
          width: 1.5,
          height: 2.3,
          depth: 0.1,
        })
        this.partition.setAttribute('material', {
          color: '#d8d8d8',
          roughness: 0.85,
          metalness: 0,
        })
        this.partition.setAttribute('scale', '1 1 1')
        this.partition.setAttribute('shadow', {
          cast: true,
          receive: false,
        })
        this.el.sceneEl.appendChild(this.partition)
      }

      this.partition.setAttribute('position', {
        x: touchPoint.x,
        y: touchPoint.y + 1.15,
        z: touchPoint.z,
      })

      camera.object3D.getWorldPosition(this.cameraPosition)
      const yawRadians = Math.atan2(
        this.cameraPosition.x - touchPoint.x,
        this.cameraPosition.z - touchPoint.z
      )
      const yawDegrees = THREE.MathUtils.radToDeg(yawRadians)
      this.partition.setAttribute('rotation', `0 ${yawDegrees} 0`)

      this.prompt.textContent = '다른 위치를 터치하면 가벽이 이동합니다'
    })
  },
}
