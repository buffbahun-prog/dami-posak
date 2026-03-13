import * as THREE from 'three'

// Generic ARAnchor interface for any 3D object
export interface ARAnchorObject {
  root: THREE.Object3D      // parent container
  update?: (delta: number, orintation?: {alpha: number; beta: number; gamma: number}) => void // optional animation update per frame
  getMesh: () => THREE.Mesh
}

export interface ARAnchor {
  root: THREE.Object3D
  object: ARAnchorObject
  prevPos: THREE.Vector3
  prevQuat: THREE.Quaternion
}

/* ---------------- CONFIG ---------------- */
export interface AnchorConfig {
  uuid: string
  image: string
  widthInMeters: number
  position?: { x: number; y: number; z?: number } // T-shirt offset
  scale?: { x: number; y: number; z?: number }    // Animation size
  createObject: () => ARAnchorObject
}