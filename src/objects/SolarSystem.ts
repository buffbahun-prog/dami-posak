import * as THREE from "three"
import { ARObject } from "./ARObject"

type PlanetData = {
  name: string
  size: number
  distance: number
  rotationSpeed: number
  revolutionSpeed: number
  tilt: number
  texture: string
  ring?: boolean
}

const PLANETS: PlanetData[] = [
  { name: "Mercury", size: 0.04, distance: 0.6, rotationSpeed: 0.02, revolutionSpeed: 0.9, tilt: 0, texture: "mercury.jpg" },
  { name: "Venus",   size: 0.09, distance: 0.9, rotationSpeed: 0.01, revolutionSpeed: 0.7, tilt: 0, texture: "venus.jpg" },
  { name: "Earth",   size: 0.1,  distance: 1.2, rotationSpeed: 0.3,  revolutionSpeed: 0.5, tilt: 0, texture: "earth-texture.jpg" },
  { name: "Mars",    size: 0.05, distance: 1.5, rotationSpeed: 0.24, revolutionSpeed: 0.4, tilt: 0, texture: "mars-texture.jpg" },
  { name: "Jupiter", size: 0.4,  distance: 2.0, rotationSpeed: 0.8,  revolutionSpeed: 0.2, tilt: 0, texture: "jupiter.jpg" },
  { name: "Saturn",  size: 0.34, distance: 3.0, rotationSpeed: 0.7,  revolutionSpeed: 0.15, tilt: 0, texture: "saturn.png", ring: true },
  { name: "Uranus",  size: 0.14, distance: 3.5, rotationSpeed: 0.4,  revolutionSpeed: 0.1, tilt: 0, texture: "uranus.jpg" },
  { name: "Neptune", size: 0.14, distance: 4.0, rotationSpeed: 0.4,  revolutionSpeed: 0.08, tilt: 0, texture: "neptune.jpg" }
]

export class SolarSystem extends ARObject {

  private planets: {
    orbit: THREE.Group
    mesh: THREE.Mesh
    rotationSpeed: number
    revolutionSpeed: number
  }[] = []

  private textureCache: Record<string, THREE.Texture> = {}

  private loader = new THREE.TextureLoader()

  constructor() {

    const container = new THREE.Object3D()
    super(container)

    const system = new THREE.Group()
    this.mainObject.add(system)

    /* scale + tilt for AR viewing */

    system.scale.setScalar(0.35)
    system.rotation.x = THREE.MathUtils.degToRad(65)

    /* ---------- SUN ---------- */

    const sunGeo = new THREE.SphereGeometry(0.7, 32, 32)

    const sunMat = new THREE.MeshBasicMaterial({
      map: this.getTexture("sun.jpg")
    })

    const sun = new THREE.Mesh(sunGeo, sunMat)
    system.add(sun)

    /* sun light */

    const sunLight = new THREE.PointLight(0xffffff, 3, 50)
    system.add(sunLight)

    /* sun glow */

    const glowMaterial = new THREE.SpriteMaterial({
      map: this.getTexture("sun-glow.png"),
      transparent: true,
      depthWrite: false
    })

    const glow = new THREE.Sprite(glowMaterial)
    glow.scale.set(3, 3, 1)

    sun.add(glow)

    /* ---------- PLANETS ---------- */

    for (const p of PLANETS) {

      const orbit = new THREE.Group()

      /* orbit ring */

      const orbitRingGeo = new THREE.RingGeometry(
        p.distance - 0.01,
        p.distance + 0.01,
        128
      )

      const orbitRingMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      })

      const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat)

      orbitRing.rotation.x = Math.PI / 2
      orbit.add(orbitRing)

      /* planet */

      const geo = new THREE.SphereGeometry(p.size, 32, 32)

      const mat = new THREE.MeshStandardMaterial({
        map: this.getTexture(p.texture),
        roughness: 1,
        metalness: 0
      })

      const mesh = new THREE.Mesh(geo, mat)

      mesh.position.x = p.distance

      /* axial tilt */

      mesh.rotation.z = THREE.MathUtils.degToRad(p.tilt)

      /* saturn ring */

      if (p.ring) {

        const saturnRingGeo = new THREE.RingGeometry(
          p.size * 1.4,
          p.size * 2.2,
          64
        )

        const saturnRingMat = new THREE.MeshBasicMaterial({
          map: this.getTexture("saturn-ring.png"),
          transparent: true,
          side: THREE.DoubleSide
        })

        const saturnRing = new THREE.Mesh(
          saturnRingGeo,
          saturnRingMat
        )

        saturnRing.rotation.x = Math.PI / 2
        saturnRing.rotation.z = THREE.MathUtils.degToRad(p.tilt)

        mesh.add(saturnRing)
      }

      orbit.add(mesh)
      system.add(orbit)

      this.planets.push({
        orbit,
        mesh,
        rotationSpeed: p.rotationSpeed,
        revolutionSpeed: p.revolutionSpeed
      })
    }
  }

  private getTexture(path: string) {

    if (!this.textureCache[path]) {
      this.textureCache[path] = this.loader.load(path)
    }

    return this.textureCache[path]
  }

  update(delta: number) {

    for (const p of this.planets) {

      /* planet spin */

      p.mesh.rotation.y += delta * p.rotationSpeed

      /* revolution */

      p.orbit.rotation.y += delta * p.revolutionSpeed
    }
  }
}