import './style.css'
import * as THREE from 'three'
import { NepalFlag } from './flagAnimation'

/* =====================================
   GLOBAL STATE
===================================== */

let currentQRConfig: number[] = []
const REAL_BARCODE_WIDTH = 0.20 // 20cm

let anchorData: {
  nx: number       // normalized X position of barcode center (0 to 1)
  ny: number       // normalized Y position of barcode center (0 to 1)
  distance: number // estimated distance from camera to barcode (in meters)
  angle: number    // rotation angle of barcode (radians)
} | null = null

// let lastDetectedTime = 0
let isStarted = false
let animationId: number | null = null
let detectInterval: number | null = null
let barcodeDetector: BarcodeDetector | null = null

if ('BarcodeDetector' in globalThis) {
  barcodeDetector = new BarcodeDetector({ formats: ['code_128'] })
} else {
  console.warn('BarcodeDetector not supported in this browser.')
}

const video = document.getElementById('video') as HTMLVideoElement
const canvas = document.getElementById('overlay') as HTMLCanvasElement

const recordBtn = document.getElementById('stbtn')
const recordTime = document.getElementById('rectime')
const pauseBtn = document.getElementById('pause')
const downloadButton = document.getElementById("downloadButton") as HTMLAnchorElement | null

let recordTimeIntervalId: number | null = null
let totalRecordSeconds = 0
let recorder: MediaRecorder | null = null
let recordedChunks: BlobPart[] = []

/* =====================================
   THREE.JS SETUP
===================================== */

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
renderer.xr.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
let camera: THREE.PerspectiveCamera
let nepalFlag: NepalFlag | null = null

function setupThree(width: number, height: number) {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
  camera.position.set(0, 0, 0)
  scene.add(camera)

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1, 1, 1)
  scene.add(dirLight)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  // Video background
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  scene.background = videoTexture

  // Nepal flag
  nepalFlag = new NepalFlag('nepal-flag.png', 1, 0.7, 32)
  nepalFlag.mesh.visible = false
  scene.add(nepalFlag.mesh)
}

/* =====================================
   RENDER LOOP
===================================== */

function startRenderLoop() {
  // -----------------------------
// Update AR content using anchorData
// -----------------------------
const updateFlagPosition = () => {
  if (!nepalFlag || !anchorData) return

  const { nx, ny, distance: detectedDistance, angle } = anchorData
  const aspect = video.videoWidth / video.videoHeight
  const fov = camera.fov * (Math.PI / 180)

  // Recompute distance from camera each frame (optional: could keep fixed)
  // const focalLength = video.videoWidth / (2 * Math.tan((camera.fov * Math.PI) / 360))
  const distance = detectedDistance // you can keep this fixed if you prefer

  const viewHeight = 2 * Math.tan(fov / 2) * distance
  const viewWidth = viewHeight * aspect

  // Map normalized barcode center to camera-relative world coordinates
  const xWorld = (nx - 0.5) * viewWidth + currentQRConfig[1]
  const yWorld = -(ny - 0.5) * viewHeight + currentQRConfig[2]

  // Smooth position
  nepalFlag.mesh.position.lerp(new THREE.Vector3(xWorld, yWorld, -distance), 0.15)

  // Scale (keep aspect ratio)
  const flagAspect = 1.5 / 0.7
  const targetWidth = currentQRConfig[3]
  const targetHeight = targetWidth / flagAspect
  nepalFlag.mesh.scale.lerp(new THREE.Vector3(targetWidth, targetHeight, 1), 0.2)

  // Smooth rotation
  nepalFlag.mesh.rotation.z = THREE.MathUtils.lerp(nepalFlag.mesh.rotation.z, -angle, 0.2)

  // Visibility
  nepalFlag.mesh.visible = currentQRConfig[0] === 0
}

// -----------------------------
// Render loop (replaces previous render inside startDetectionLoop)
// -----------------------------
const render = () => {
  if (nepalFlag && anchorData) updateFlagPosition()
  if (nepalFlag?.mesh.visible) nepalFlag.update()
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(render)
}
render()
}

/* =====================================
   CAMERA STREAM
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

  recordBtn?.querySelector("div")?.classList.add("recording")
  startRecording()
  setupThree(video.videoWidth, video.videoHeight)
  startRenderLoop()
  startDetectionLoop()
  setupWebXR()

  isStarted = true
}

async function setupWebXR() {
  if (!navigator.xr) return
  const supported = await navigator.xr.isSessionSupported('immersive-ar')
  if (!supported) return console.warn('WebXR AR not supported')

  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  })
  renderer.xr.setSession(session)
}

/* =====================================
   BARCODE DETECTION & INITIAL ANCHOR
===================================== */

function startDetectionLoop() {
  if (!barcodeDetector || !nepalFlag) return

  let smoothedDistance = 0
  let jsonReceived = false;
  let anchorData: {
    nx: number
    ny: number
    distance: number
    angle: number
  } | null = null

  let lastDetectedTime = 0; // track last barcode detection
  let detected: boolean | undefined = undefined;

  const detectOnce = async () => {
    try {
      const barcodes = await barcodeDetector!.detect(video)
      if (barcodes.length === 0) return

      const barcode = barcodes[0]
      const box = barcode.boundingBox

      // 1️⃣ Parse JSON from barcode
      if (!jsonReceived) {
        try {
          currentQRConfig = barcode.rawValue.split(",").map(Number)
          console.log("parsed", currentQRConfig)
          jsonReceived = true;
        } catch {
          console.warn('Barcode does not contain valid JSON')
          return false;
        }
      }

      // 2️⃣ Estimate distance using barcode width
      const focalLength = video.videoWidth / (2 * Math.tan((camera.fov * Math.PI) / 360))
      const rawDistance = (REAL_BARCODE_WIDTH * focalLength) / box.width
      smoothedDistance = THREE.MathUtils.lerp(smoothedDistance || rawDistance, rawDistance, 0.2)
      const distance = smoothedDistance

      // 3️⃣ Normalize center
      const nx = (box.x + box.width / 2) / video.videoWidth
      const ny = (box.y + box.height / 2) / video.videoHeight

      // 4️⃣ Barcode rotation
      let angle = 0
      if (barcode.cornerPoints.length >= 2) {
        const [tl, tr] = barcode.cornerPoints
        angle = Math.atan2(tr.y - tl.y, tr.x - tl.x)
      }

      anchorData = { nx, ny, distance, angle }
      return true;

      // 5️⃣ Stop further detection
      // if (detectInterval) clearInterval(detectInterval)

    } catch (err) {
      console.error('Detection error:', err)
      return false;
    }
  }

  // Run detection loop until data is obtained
  detectInterval = window.setInterval(async () => {
    const now = Date.now();
    const detectedHere = await detectOnce();
  // If barcode hasn't been detected for > 5 seconds, try detection again
  if (now - lastDetectedTime > 1000) {
    // If after detectOnce, anchorData is still null, hide the flag
    detected = detectedHere;
    if (!detectedHere) {
      // if (nepalFlag) nepalFlag.mesh.visible = false;
    } else {
      // update lastDetectedTime
      lastDetectedTime = now;
    }
  }
  }, 250)

  // 6️⃣ Update AR content using anchorData in render loop
  const updateFlagPosition = () => {
    if (!nepalFlag || !anchorData) return

    const { nx, ny, distance, angle } = anchorData
    const aspect = video.videoWidth / video.videoHeight
    const fov = camera.fov * (Math.PI / 180)

    const viewHeight = 2 * Math.tan(fov / 2) * distance
    const viewWidth = viewHeight * aspect

    const xWorld = (nx - 0.5) * viewWidth + currentQRConfig[1]
    const yWorld = -(ny - 0.5) * viewHeight + currentQRConfig[2]

    // Smooth position
    nepalFlag.mesh.position.lerp(new THREE.Vector3(xWorld, yWorld, -distance), 0.15)

    // Scale (preserve aspect ratio)
    const flagAspect = 1.5 / 0.7
    const targetWidth = currentQRConfig[3]
    const targetHeight = targetWidth / flagAspect
    nepalFlag.mesh.scale.lerp(new THREE.Vector3(targetWidth, targetHeight, 1), 0.2)

    // Smooth rotation
    nepalFlag.mesh.rotation.z = THREE.MathUtils.lerp(nepalFlag.mesh.rotation.z, -angle, 0.2)

    // Visibility
    nepalFlag.mesh.visible = currentQRConfig[0] === 0 && !!detected;
  }

  // Add this call inside your render loop
  function render() {
    if (nepalFlag && anchorData) updateFlagPosition()
    renderer.render(scene, camera)
    animationId = requestAnimationFrame(render)
  }
  render()
}

/* =====================================
   STOP STREAM
===================================== */

function stopStream() {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(track => track.stop())
  video.srcObject = null
  recordBtn?.querySelector("div")?.classList.remove("recording")

  if (recorder && recorder.state !== "inactive") {
    recorder.stop()
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder!.mimeType })
      if (recordTimeIntervalId) clearInterval(recordTimeIntervalId)
      recordTime?.classList.remove("show")
      recordTime!.textContent = ''
      if (downloadButton) {
        downloadButton.classList.add("show")
        downloadButton.href = URL.createObjectURL(blob)
        downloadButton.download = "RecordedVideo.webm"
      }
    }
  }

  if (animationId) cancelAnimationFrame(animationId)
  if (detectInterval) clearInterval(detectInterval)
  if (nepalFlag) nepalFlag.mesh.visible = false

  renderer.clear()
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  isStarted = false
}

/* =====================================
   RECORDING
===================================== */

function startRecording() {
  const canvasStream = canvas.captureStream(30)
  recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9' })
  recordedChunks = []
  totalRecordSeconds = 0
  recordTimeIntervalId = startTimer()

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data)
  }
  recorder.start()
}

function pauseRecording() {
  if (recorder?.state === "recording") {
    recorder.pause()
    if (recordTimeIntervalId) clearInterval(recordTimeIntervalId)
  }
}

function resumeRecording() {
  if (recorder?.state === "paused") {
    recorder.resume()
    recordTimeIntervalId = startTimer()
  }
}

/* =====================================
   BUTTONS
===================================== */

recordBtn?.addEventListener('click', () => {
  isStarted ? stopStream() : startStream()
})

pauseBtn?.addEventListener('click', () => {
  if (!pauseBtn) return
  if (pauseBtn.classList.contains("paused")) {
    pauseBtn.classList.remove("paused")
    resumeRecording()
  } else {
    pauseBtn.classList.add("paused")
    pauseRecording()
  }
})

function startTimer(): number {
  recordTime?.classList.add("show")

  return setInterval(() => {
    totalRecordSeconds++
    const hours = Math.floor(totalRecordSeconds / 3600)
    const minutes = Math.floor((totalRecordSeconds % 3600) / 60)
    const seconds = totalRecordSeconds % 60
    if (recordTime) {
      recordTime.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
  }, 1000)
}