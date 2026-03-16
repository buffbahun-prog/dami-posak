import * as THREE from 'three'
import { ARObject } from './ARObject'

export class Mars extends ARObject {
  private spinVelocityX = 0
private spinVelocityY = 0
private spinVelocityZ = 0
  constructor(textureUrl: string, radius = 0.3) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32)
    const loader = new THREE.TextureLoader()
    const texture = loader.load(textureUrl)
    const material = new THREE.MeshPhongMaterial({ map: texture })
    const mesh = new THREE.Mesh(geometry, material)
    super(mesh, radius * 1.1) // pass shadow radius
  }

 update(
  delta: number,
  orientation?: { alpha: number; beta: number; gamma: number }
) {

  if (orientation) {

    const alpha = orientation.alpha ?? 0
    const beta  = orientation.beta ?? 0
    const gamma = orientation.gamma ?? 0

    const targetVelX = THREE.MathUtils.clamp(-beta / 45, -1, 1)
    const targetVelY = THREE.MathUtils.clamp(gamma / 45, -1, 1)
    const targetVelZ = THREE.MathUtils.clamp(alpha / 180, -1, 1)

    // smooth velocities
    this.spinVelocityX += (targetVelX - this.spinVelocityX) * 0.08
    this.spinVelocityY += (targetVelY - this.spinVelocityY) * 0.08
    this.spinVelocityZ += (targetVelZ - this.spinVelocityZ) * 0.08
  }

  const spinSpeed = 1.2

  this.mainObject.rotation.x += delta * spinSpeed * this.spinVelocityX
  this.mainObject.rotation.y += delta * spinSpeed * this.spinVelocityY
  this.mainObject.rotation.z += delta * spinSpeed * this.spinVelocityZ
}
}