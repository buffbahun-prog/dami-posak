// flagAnimation.ts
import * as THREE from 'three'

export class NepalFlag {
  public mesh: THREE.Mesh
  private geometry: THREE.PlaneGeometry
  private clock: THREE.Clock

  constructor(textureUrl: string, width = 1.5, height = 1, segments = 32) {
    this.clock = new THREE.Clock()

    // Plane geometry for waving flag
    this.geometry = new THREE.PlaneGeometry(width, height, segments, segments)

    // Load texture
    const loader = new THREE.TextureLoader()
    const texture = loader.load(textureUrl)

    const material = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
    material.depthWrite = false

    this.mesh = new THREE.Mesh(this.geometry, material)
  }

  // Call in render loop
  update() {
    const time = this.clock.getElapsedTime()

    for (let i = 0; i < this.geometry.attributes.position.count; i++) {
      const x = this.geometry.attributes.position.getX(i)
      const y = this.geometry.attributes.position.getY(i)
      const wave = 0.05 * Math.sin((x + time * 2) * 3) * Math.cos((y + time * 1.5) * 2)
      this.geometry.attributes.position.setZ(i, wave)
    }

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.computeVertexNormals()
  }
}