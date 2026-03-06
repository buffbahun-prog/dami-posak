import * as THREE from 'three'
import { ARObject } from './ARObject'

export class Earth extends ARObject {
  constructor(textureUrl: string, radius = 0.5) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32)
    const loader = new THREE.TextureLoader()
    const texture = loader.load(textureUrl)
    const material = new THREE.MeshPhongMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    super(mesh, radius * 1.1) // pass shadow radius
  }

  update(delta: number) {
    // Rotate Earth
    this.rotateY(delta, 0.3)
  }
}