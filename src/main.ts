import * as THREE from 'three'
import { NepalFlag } from './flagAnimation'

/* ---------------- GLOBAL ---------------- */
const canvas = document.getElementById("overlay") as HTMLCanvasElement
const startBtn = document.getElementById("stbtn") as HTMLButtonElement
const qrImage = document.getElementById("qr") as HTMLImageElement

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let flag: NepalFlag
let xrSession: XRSession | null = null

/* ---------------- THREE SETUP ---------------- */
function setupThree() {
  renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true})
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 10)
  scene.add(camera)

  scene.add(new THREE.AmbientLight(0xffffff,0.7))
  const dir = new THREE.DirectionalLight(0xffffff,1)
  dir.position.set(1,1,1)
  scene.add(dir)

  flag = new NepalFlag("nepal-flag.png",1,0.7,32)
  flag.mesh.visible=false
  scene.add(flag.mesh)
}

/* ---------------- XR FRAME LOOP ---------------- */
// @ts-ignore 
function onXRFrame(time: number, frame: XRFrame) {
  const session = frame.session
  const refSpace = renderer.xr.getReferenceSpace()
  // @ts-ignore
  const results = frame.getImageTrackingResults?.() || []

  for(const result of results){
    const pose = frame.getPose(result.imageSpace, refSpace as XRSpace)
    if(!pose) continue

    flag.mesh.visible = true
    flag.mesh.position.set(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z
    )
    flag.mesh.quaternion.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w
    )

    // Optional scaling based on QR size
    const width = 0.3 // meters
    const height = width / 1.5
    flag.mesh.scale.set(width, height, 1)

    flag.update()
  }

  renderer.render(scene,camera)
  session.requestAnimationFrame(onXRFrame)
}

/* ---------------- START AR ---------------- */
async function startAR() {
  if(!navigator.xr){
    alert("WebXR not supported")
    return
  }

  const supported = await navigator.xr.isSessionSupported("immersive-ar")
  if(!supported){
    alert("WebXR immersive-ar not supported")
    return
  }

  await qrImage.decode()
  const bitmap = await createImageBitmap(qrImage)

  const sessionInit: XRSessionInit = {
    requiredFeatures:["image-tracking","dom-overlay"],
    // @ts-ignore
    trackedImages:[{image: bitmap, widthInMeters:0.2}],
    domOverlay:{root:document.body}
  }

  xrSession = await navigator.xr.requestSession("immersive-ar", sessionInit)
  renderer.xr.setReferenceSpaceType("local")
  renderer.xr.setSession(xrSession)
  xrSession.requestAnimationFrame(onXRFrame)
}

/* ---------------- BUTTON ---------------- */
startBtn.addEventListener("click", startAR)

/* ---------------- INITIALIZE ---------------- */
setupThree()