import './style.css'
import * as THREE from 'three'
import { NepalFlag } from './flagAnimation'

// Extend WebXR types for image tracking
interface XRTrackedImageInit {
  image: ImageBitmap
  widthInMeters: number
}

interface XRSessionInitWithTracking extends XRSessionInit {
  trackedImages?: XRTrackedImageInit[]
}

interface XRImageTrackingResult {
  index: number
  imageSpace: XRSpace
  trackingState: "tracked" | "emulated"
}

interface XRPose {
  transform: {
    position: DOMPointReadOnly
    orientation: DOMPointReadOnly
  }
}

type XRFrameRequestCallback = (time: number, frame: XRFrame) => void;

interface XRFrame {
  getPose?(
    space: XRSpace,
    baseSpace: XRSpace
  ): XRPose | undefined

  getImageTrackingResults?(): {
    index: number
    imageSpace: XRSpace
    trackingState: "tracked" | "emulated"
  }[]
}

/* =====================================
   GLOBAL STATE
===================================== */

let currentQRConfig: number[] = []
const REAL_BARCODE_WIDTH = 0.20 // 20cm real printed width

let isStarted = false
let barcodeDetector: BarcodeDetector | null = null

if ('BarcodeDetector' in globalThis) {
  barcodeDetector = new BarcodeDetector({ formats: ['code_128'] })
} else {
  console.warn('BarcodeDetector not supported.')
}

const video = document.getElementById('video') as HTMLVideoElement
const canvas = document.getElementById('overlay') as HTMLCanvasElement

/* =====================================
   THREE + XR SETUP
===================================== */

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
renderer.xr.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
let camera: THREE.PerspectiveCamera
let nepalFlag: NepalFlag | null = null

function setupThree(width: number, height: number) {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
  scene.add(camera)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1, 1, 1)
  scene.add(dirLight)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  scene.background = videoTexture

  nepalFlag = new NepalFlag('nepal-flag.png', 1, 0.7, 32)
  nepalFlag.mesh.visible = false
  scene.add(nepalFlag.mesh)
}

/* =====================================
   STEP 1 — Detect Barcode Once
===================================== */

async function detectBarcodeOnce(): Promise<boolean> {
  if (!barcodeDetector) return false

  const barcodes = await barcodeDetector.detect(video)
  if (barcodes.length === 0) return false

  try {
    currentQRConfig = barcodes[0].rawValue.split(',').map(Number)
    console.log("QR Config:", currentQRConfig)
    return true
  } catch {
    console.warn("Invalid barcode data")
    return false
  }
}

/* =====================================
   STEP 2 — Start WebXR Image Tracking
===================================== */

async function setupWebXR() {
  if (!navigator.xr) {
    console.warn("WebXR not available")
    return
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar')
  if (!supported) {
    console.warn("WebXR AR not supported on this device")
    return
  }

  // Load exact barcode image printed on shirt
  const img = document.createElement("img")
  img.src = "barcode-image.png"
  await img.decode()

  const bitmap = await createImageBitmap(img)

  const sessionInit: XRSessionInitWithTracking = {
    requiredFeatures: ["image-tracking", "dom-overlay"],
    trackedImages: [
      {
        image: bitmap,
        widthInMeters: REAL_BARCODE_WIDTH
      }
    ],
    domOverlay: { root: document.body }
  }
  
  const session = await navigator.xr.requestSession("immersive-ar", sessionInit)

  renderer.xr.setReferenceSpaceType("local")
  renderer.xr.setSession(session)

  renderer.setAnimationLoop(onXRFrame)
}

/* =====================================
   STEP 3 — XR FRAME LOOP (REAL ANCHOR)
===================================== */

function onXRFrame(time: number, frame: XRFrame) {
  const session = renderer.xr.getSession()
  if (!session) return

  const referenceSpace = renderer.xr.getReferenceSpace()
  const results = frame.getImageTrackingResults?.() || []

  if (!referenceSpace) return

  for (const result of results) {
    const pose = frame.getPose?.(result.imageSpace, referenceSpace)
    if (!pose) continue

    const { position, orientation } = pose.transform

    if (!nepalFlag) continue

    // Visibility control from QR config
    nepalFlag.mesh.visible = currentQRConfig[0] === 0

    // Position (real world)
    nepalFlag.mesh.position.set(
      position.x + (currentQRConfig[1] || 0),
      position.y + (currentQRConfig[2] || 0),
      position.z
    )

    // Rotation (real orientation from XR)
    nepalFlag.mesh.quaternion.set(
      orientation.x,
      orientation.y,
      orientation.z,
      orientation.w
    )

    // Scale
    const flagAspect = 1.5 / 0.7
    const width = currentQRConfig[3] || 0.15
    const height = width / flagAspect

    nepalFlag.mesh.scale.set(width, height, 1)

    // Update animation
    if (nepalFlag.mesh.visible) {
      nepalFlag.update()
    }
  }

  renderer.render(scene, camera)
}

/* =====================================
   CAMERA START
===================================== */

async function startStream() {
  if (isStarted) return

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  })

  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  await new Promise<void>(resolve => {
    if (video.readyState >= 1) resolve()
    else video.onloadedmetadata = () => resolve()
  })

  await video.play()

  setupThree(video.videoWidth, video.videoHeight)

  // Detect barcode until successful
  let detected = false
  while (!detected) {
    detected = await detectBarcodeOnce()
    if (!detected) await new Promise(r => setTimeout(r, 300))
  }

  // Start WebXR tracking
  await setupWebXR()

  isStarted = true
}

/* =====================================
   STOP STREAM
===================================== */

function stopStream() {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(track => track.stop())
  video.srcObject = null

  const session = renderer.xr.getSession()
  session?.end()

  renderer.setAnimationLoop(null)

  if (nepalFlag) nepalFlag.mesh.visible = false

  renderer.clear()
  isStarted = false
}

/* =====================================
   BUTTON
===================================== */

document.getElementById('stbtn')?.addEventListener('click', () => {
  isStarted ? stopStream() : startStream()
})