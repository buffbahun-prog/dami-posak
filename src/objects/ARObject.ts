import * as THREE from "three"

export class ARObject {

  public root: THREE.Object3D
  protected mainObject: THREE.Object3D
  protected shadowPlane?: THREE.Mesh

  constructor(object: THREE.Object3D, shadowRadius?: number) {

    this.root = new THREE.Object3D()

    this.mainObject = object
    this.root.add(object)

    /* ---------- Optional Shadow ---------- */

    if (shadowRadius !== undefined) {

      const shadowGeo = new THREE.CircleGeometry(shadowRadius, 32)

      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3
      })

      const shadow = new THREE.Mesh(shadowGeo, shadowMat)

      shadow.rotation.x = -Math.PI / 2
      shadow.position.y = -shadowRadius + 0.01

      this.shadowPlane = shadow

      this.root.add(shadow)
    }
  }

  /* ---------- Update Loop ---------- */

  update(_delta: number) {}

  /* ---------- Rotation Helpers ---------- */

  rotateX(delta: number, speed = 0.2) {
    this.mainObject.rotation.x += delta * speed
  }

  rotateY(delta: number, speed = 0.2) {
    this.mainObject.rotation.y += delta * speed
  }

  rotateZ(delta: number, speed = 0.2) {
    this.mainObject.rotation.z += delta * speed
  }

  /* ---------- Shadow Controls ---------- */

  setShadowScale(scale: number) {
    if (!this.shadowPlane) return
    this.shadowPlane.scale.set(scale, scale, 1)
  }

  setShadowOpacity(opacity: number) {
    if (!this.shadowPlane) return
    ;(this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = opacity
  }

  /* ---------- Accessors ---------- */

  getMesh() {
    return this.mainObject
  }

}