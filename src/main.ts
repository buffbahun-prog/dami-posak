// main.ts
import * as THREE from 'three'
import type { ARAnchor, ARAnchorObject } from './types/types'
import { anchorConfigs } from './configs/anchorConfigs'

const canvas = document.getElementById("overlay") as HTMLCanvasElement
const startBtn = document.getElementById("stbtn") as HTMLButtonElement

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let xrSession: XRSession | null = null
const anchors: ARAnchor[] = []

/* ---------------- THREE SETUP ---------------- */
function setupThree() {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // updated per latest THREE.js

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10)
  scene.add(camera)

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const dir = new THREE.DirectionalLight(0xffffff, 1)
  dir.position.set(1, 3, 2)
  dir.castShadow = true
  dir.shadow.mapSize.width = 1024
  dir.shadow.mapSize.height = 1024
  scene.add(dir)
}

/* ---------------- CREATE ANCHOR ---------------- */
function createAnchor(object: ARAnchorObject): ARAnchor {
  object.root.visible = false
  scene.add(object.root)

  return {
    root: object.root,
    object,
    prevPos: new THREE.Vector3(),
    prevQuat: new THREE.Quaternion()
  }
}

/* ---------------- XR FRAME LOOP ---------------- */
let lastTime: number | null = null
const smoothing = 0.1
const threshold = 0.002

// @ts-ignore
function onXRFrame(time: number, frame: XRFrame) {
  const session = frame.session
  const refSpace = renderer.xr.getReferenceSpace()
  // @ts-ignore
  const results = frame.getImageTrackingResults?.() || []

  if (lastTime === null) lastTime = time
  const delta = (time - lastTime) / 1000
  lastTime = time

  // Update each anchor
  // Update visibility first
anchors.forEach(anchor => {
  anchor.root.visible = false
})

for (const result of results) {
  // Ignore markers that are not actively tracked
  if (result.trackingState !== "tracked") continue

  const anchor = anchors[result.index]
  if (!anchor) continue

  const pose = frame.getPose(result.imageSpace, refSpace as XRSpace)
  if (!pose) continue

  const targetPos = new THREE.Vector3(
    pose.transform.position.x,
    pose.transform.position.y,
    pose.transform.position.z
  )

  const targetQuat = new THREE.Quaternion(
    pose.transform.orientation.x,
    pose.transform.orientation.y,
    pose.transform.orientation.z,
    pose.transform.orientation.w
  )

  // Smooth movement
  anchor.prevPos.lerp(targetPos, smoothing)
  anchor.prevQuat.slerp(targetQuat, smoothing)

  // Deadzone
  if (targetPos.distanceTo(anchor.prevPos) < threshold) {
    anchor.prevPos.copy(anchor.prevPos)
  }

  // Apply T-shirt offset
      const config = anchorConfigs[result.index]
      console.log(config, result.index);
      if (config.position) {
        anchor.root.position.set(
          anchor.prevPos.x + config.position.x,
          anchor.prevPos.y + config.position.y,
          anchor.prevPos.z + (config.position.z ?? 0)
        )
      } else {
        anchor.root.position.copy(anchor.prevPos)
      }


  anchor.root.visible = true
  // anchor.root.position.copy(anchor.prevPos)
  anchor.root.quaternion.copy(anchor.prevQuat)

   // Apply custom scale
      if (config.scale) {
        anchor.root.scale.set(config.scale.x, config.scale.y, config.scale.z ?? 1)
      } else {
        // Optional fixed scale
  anchor.root.scale.set(0.3, 0.3, 0.3)
      }

  // Let object animate itself
  anchor.object.update?.(delta)
}

  renderer.render(scene, camera)
  session.requestAnimationFrame(onXRFrame)
}

/* ---------------- START AR ---------------- */
async function startAR() {
  if (!navigator.xr) return alert("WebXR not supported")
  if (!(await navigator.xr.isSessionSupported("immersive-ar"))) return alert("AR not supported")

  const trackedImages = []
  anchors.length = 0

for (const config of anchorConfigs) {
  const img = document.createElement("img")
  img.src = config.image
  await img.decode()

  const bitmap = await createImageBitmap(img)

  trackedImages.push({
    image: bitmap,
    widthInMeters: config.widthInMeters
  })

  const object = config.createObject()
  const anchor = createAnchor(object)

// Apply custom scale and position
if (config.scale) {
  anchor.root.scale.set(config.scale.x, config.scale.y, config.scale.z ?? 1)
}

if (config.position) {
  anchor.root.position.set(config.position.x, config.position.y, config.position.z ?? 0)
}
  anchors.push(createAnchor(object))

  img.remove()
}

  const sessionInit: XRSessionInit = {
    requiredFeatures: ["image-tracking", "dom-overlay"],
    // @ts-ignore
    trackedImages,
    domOverlay: { root: document.body }
  }

  xrSession = await navigator.xr.requestSession("immersive-ar", sessionInit)
  renderer.xr.setReferenceSpaceType("local")
  renderer.xr.setSession(xrSession)
  xrSession.requestAnimationFrame(onXRFrame)
}

/* ---------------- INITIALIZE ---------------- */
setupThree()

startBtn.addEventListener("click", startAR)