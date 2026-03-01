import './style.css'
import * as THREE from 'three'
import { NepalFlag } from './flagAnimation'

/* =====================================
   GLOBAL STATE
===================================== */

let currentQRConfig: number[] = []
const REAL_BARCODE_WIDTH = 0.20  // 20 cm
let isStarted = false
let animationId: number | null = null
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
   THREE + WebXR SETUP
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

  const dirLight = new THREE.DirectionalLight(0xffffff, 1)
  dirLight.position.set(1, 1, 1)
  scene.add(dirLight)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  scene.background = videoTexture

  nepalFlag = new NepalFlag('nepal-flag.png', 1, 0.7, 32)
  nepalFlag.mesh.visible = false
  scene.add(nepalFlag.mesh)
}

/* =====================================
   RENDER LOOP
===================================== */

function startRenderLoop() {
  function render() {
    if (nepalFlag && nepalFlag.mesh.visible) {
      nepalFlag.update()
    }
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

  await new Promise<void>((resolve) => {
    if (video.readyState >= 1) resolve()
    else video.onloadedmetadata = () => resolve()
  })
  await video.play()

  recordBtn?.querySelector("div")?.classList.add("recording")
  startRecording()

  setupThree(video.videoWidth, video.videoHeight)
  startRenderLoop()

  // Initialize barcode anchor
  await initBarcodeAnchor()

  // WebXR optional
  if (navigator.xr) {
    const supported = await navigator.xr.isSessionSupported('immersive-ar')
    if (supported) {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['dom-overlay'],
        domOverlay: { root: document.body },
      })
      renderer.xr.setSession(session)
    }
  }

  isStarted = true
}

/* =====================================
   BARCODE ANCHOR (ONE-TIME DETECTION)
===================================== */

async function initBarcodeAnchor() {
  if (!barcodeDetector || !nepalFlag) return

  let barcode: DetectedBarcode | null = null
  let smoothedDistance = 0

  while (!barcode) {
    try {
      const barcodes = await barcodeDetector.detect(video)
      if (barcodes.length > 0) {
        barcode = barcodes[0]
        break
      }
    } catch (err) {
      console.error('Detection error:', err)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  // Parse QR/Barcode JSON
  try {
    const parsed = barcode!.rawValue.split(",").map(st => parseFloat(st))
    currentQRConfig = parsed
  } catch {
    console.warn('Invalid barcode data')
    return
  }

  // Anchor flag position
  const box = barcode!.boundingBox
  const barcodePixelWidth = box.width
  const focalLength = video.videoWidth / (2 * Math.tan((camera.fov * Math.PI) / 360))
  smoothedDistance = (REAL_BARCODE_WIDTH * focalLength) / barcodePixelWidth

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const nx = centerX / video.videoWidth
  const ny = centerY / video.videoHeight

  const aspect = video.videoWidth / video.videoHeight
  const fov = camera.fov * (Math.PI / 180)
  const viewHeight = 2 * Math.tan(fov / 2) * smoothedDistance
  const viewWidth = viewHeight * aspect

  const xWorld = (nx - 0.5) * viewWidth + currentQRConfig[1]
  const yWorld = -(ny - 0.5) * viewHeight + currentQRConfig[2]
  const distance = smoothedDistance

  // Keep flag aspect ratio
  const flagAspect = 1.5 / 0.7
  const targetWidth = currentQRConfig[3]
  const targetHeight = targetWidth / flagAspect

  // Setup anchored flag
  nepalFlag.mesh.position.set(xWorld, yWorld, -distance)
  nepalFlag.mesh.scale.set(targetWidth, targetHeight, 1)
  nepalFlag.mesh.visible = currentQRConfig[0] === 0

  // Smoothly follow camera rotation (optional)
  if (barcode!.cornerPoints.length >= 2) {
    const [tl, tr] = barcode!.cornerPoints
    const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x)
    nepalFlag.mesh.rotation.z = -angle
  }
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
      if (recordTime) {
        recordTime.classList.remove("show")
        recordTime.textContent = ''
      }
      if (downloadButton) {
        downloadButton.classList.add("show")
        downloadButton.href = URL.createObjectURL(blob)
        downloadButton.download = "RecordedVideo.webm"
      }
    }
  }

  if (animationId) cancelAnimationFrame(animationId)
  if (nepalFlag) nepalFlag.mesh.visible = false

  renderer.clear()
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

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
  recorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data) }
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

recordBtn?.addEventListener('click', () => { isStarted ? stopStream() : startStream() })
pauseBtn?.addEventListener('click', () => {
  if (!pauseBtn) return
  pauseBtn.classList.toggle('paused')
  pauseBtn.classList.contains('paused') ? pauseRecording() : resumeRecording()
})

function startTimer(): number {
  recordTime?.classList.add("show")
  return setInterval(() => {
    totalRecordSeconds++
    const h = Math.floor(totalRecordSeconds / 3600)
    const m = Math.floor((totalRecordSeconds % 3600) / 60)
    const s = totalRecordSeconds % 60
    if (recordTime) recordTime.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }, 1000)
}