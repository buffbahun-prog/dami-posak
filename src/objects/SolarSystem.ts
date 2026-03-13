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
  {
    name: "Mercury",
    size: 0.04,
    distance: 1,
    rotationSpeed: 0.02,
    revolutionSpeed: 0.9,
    tilt: 0.01,
    texture: "mercury.jpg"
  },
  {
    name: "Venus",
    size: 0.09,
    distance: 1.5,
    rotationSpeed: 0.01,
    revolutionSpeed: 0.7,
    tilt: 177,
    texture: "venus.jpg"
  },
  {
    name: "Earth",
    size: 0.1,
    distance: 2,
    rotationSpeed: 0.3,
    revolutionSpeed: 0.5,
    tilt: 23.4,
    texture: "earth-texture.jpg"
  },
  {
    name: "Mars",
    size: 0.05,
    distance: 2.6,
    rotationSpeed: 0.24,
    revolutionSpeed: 0.4,
    tilt: 25,
    texture: "mars-texture.jpg"
  },
  {
    name: "Jupiter",
    size: 0.4,
    distance: 3.8,
    rotationSpeed: 0.8,
    revolutionSpeed: 0.2,
    tilt: 3,
    texture: "jupiter.jpg"
  },
  {
    name: "Saturn",
    size: 0.34,
    distance: 5,
    rotationSpeed: 0.7,
    revolutionSpeed: 0.15,
    tilt: 26,
    texture: "saturn.png",
    ring: true
  },
  {
    name: "Uranus",
    size: 0.14,
    distance: 6,
    rotationSpeed: 0.4,
    revolutionSpeed: 0.1,
    tilt: 98,
    texture: "uranus.jpg"
  },
  {
    name: "Neptune",
    size: 0.14,
    distance: 7,
    rotationSpeed: 0.4,
    revolutionSpeed: 0.08,
    tilt: 28,
    texture: "neptune.jpg"
  }
]

export class SolarSystem extends ARObject {

  private planets: {
    orbit: THREE.Group
    mesh: THREE.Mesh
    rotationSpeed: number
    revolutionSpeed: number
  }[] = []

  constructor() {

     /* invisible container mesh (required by ARObject) */

    const container = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    )

    super(container, 8)

    const system = new THREE.Group()
    this.mainMesh.add(system)

    system.scale.setScalar(0.35)
    system.rotation.x = THREE.MathUtils.degToRad(65)

    const loader = new THREE.TextureLoader()

    /* ---------- SUN ---------- */

    const sunGeo = new THREE.SphereGeometry(0.7, 32, 32)

    const sunMat = new THREE.MeshBasicMaterial({
      map: loader.load("sun.jpg")
    })

    const sun = new THREE.Mesh(sunGeo, sunMat)
    system.add(sun)

    const sunLight = new THREE.PointLight(0xffffff, 3, 50)
    system.add(sunLight)

    /* ---------- PLANETS ---------- */

    for (const p of PLANETS) {

      const orbit = new THREE.Group()

      /* orbit ring */

      const ringGeo = new THREE.RingGeometry(
        p.distance - 0.01,
        p.distance + 0.01,
        128
      )

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      })

      const orbitRing = new THREE.Mesh(ringGeo, ringMat)

      orbitRing.rotation.x = Math.PI / 2
    //   orbitRing.rotation.x = 0
      system.add(orbitRing)

      /* planet */

      const geo = new THREE.SphereGeometry(p.size, 32, 32)

      const mat = new THREE.MeshStandardMaterial({
        map: loader.load(p.texture)
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
          map: loader.load("/textures/saturn-ring.png"),
          transparent: true,
          side: THREE.DoubleSide
        })

        const saturnRing = new THREE.Mesh(
          saturnRingGeo,
          saturnRingMat
        )

        saturnRing.rotation.x = Math.PI / 2
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

  update(delta: number) {

    for (const p of this.planets) {

      /* spin */
      p.mesh.rotation.y += delta * p.rotationSpeed

      /* orbit */
      p.orbit.rotation.y += delta * p.revolutionSpeed
    }
  }
}