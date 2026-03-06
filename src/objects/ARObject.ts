import * as THREE from 'three'

export class ARObject {
  public root: THREE.Object3D        // container, used by AR manager
  protected mainMesh: THREE.Mesh     // actual 3D mesh
  protected shadowPlane: THREE.Mesh  // optional shadow

  constructor(mesh: THREE.Mesh, shadowRadius = 0.5) {
    this.root = new THREE.Object3D()
    this.mainMesh = mesh
    this.root.add(this.mainMesh)

    // ---------------- Shadow ----------------
    const shadowGeo = new THREE.CircleGeometry(shadowRadius, 32)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    })
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat)
    this.shadowPlane.rotation.x = -Math.PI / 2
    this.shadowPlane.position.y = -shadowRadius + 0.01
    this.root.add(this.shadowPlane)
  }

  // ---------------- Rotation / Animation ----------------
  // Called each frame from AR loop
  // @ts-ignore
  update(delta: number) {
    // Override in subclasses
  }

  rotateX(delta: number, speed = 0.2) {
    this.mainMesh.rotation.x += delta * speed
  }

  rotateY(delta: number, speed = 0.2) {
    this.mainMesh.rotation.y += delta * speed
  }

  rotateZ(delta: number, speed = 0.2) {
    this.mainMesh.rotation.z += delta * speed
  }

  // ---------------- Shadow Helpers ----------------
  setShadowScale(scale: number) {
    this.shadowPlane.scale.set(scale, scale, 1)
  }

  setShadowOpacity(opacity: number) {
    (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = opacity
  }
}