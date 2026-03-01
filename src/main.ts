import './style.css'
import * as THREE from 'three'
import { NepalFlag } from './flagAnimation'

/* =====================================
   GLOBAL STATE
===================================== */

// QR configuration from JSON
let currentQRConfig: {
  anim: string
  posX: number
  posY: number
  width: number
  height: number
} | null = null

const REAL_QR_SIZE = 0.04 // 4cm printed QR on shirt

let lastDetectedTime = 0
// const detectionGracePeriod = 500 // ms
let isStarted = false
let animationId: number | null = null
let detectInterval: number | null = null
let barcodeDetector: BarcodeDetector | null = null

if ('BarcodeDetector' in globalThis) {
  barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] })
} else {
  console.warn('BarcodeDetector not supported in this browser.')
}

const video = document.getElementById('video') as HTMLVideoElement
const canvas = document.getElementById('overlay') as HTMLCanvasElement

const recordBtn = document.getElementById('stbtn');
const recordTime = document.getElementById('rectime');
const pauseBtn = document.getElementById('pause');
const downloadButton = document.getElementById("downloadButton") as HTMLAnchorElement | null;

let recordTimeIntervalId: number | null = null;
let totalRecordSeconds = 0;

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

// Nepal flag variable
let nepalFlag: NepalFlag | null = null

function setupThree(width: number, height: number) {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
  camera.position.set(0, 0, 0)
  scene.add(camera)

  // Add directional light for Phong material
const dirLight = new THREE.DirectionalLight(0xffffff, 1)
dirLight.position.set(1, 1, 1)
scene.add(dirLight)

// Optional ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

  // Use camera video as scene background
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  scene.background = videoTexture

  // Add Nepal flag
  nepalFlag = new NepalFlag('nepal-flag.png', 1, 0.7, 32)
  nepalFlag.mesh.visible = false // initially hidden
  scene.add(nepalFlag.mesh)
}

/* =====================================
   RENDER LOOP
===================================== */

function startRenderLoop() {
  function render() {
    // Update flag animation
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

  recordBtn?.querySelector("div")?.classList.add("recording");
  startRecording()

  setupThree(video.videoWidth, video.videoHeight)
  startRenderLoop()
  startDetectionLoop()

  // WebXR optional
  if (navigator.xr) {
    const supported = await navigator.xr.isSessionSupported('immersive-ar')
    if (supported) {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['dom-overlay'],
        domOverlay: { root: document.body },
      })
      renderer.xr.setSession(session)
    } else {
      console.warn('WebXR AR not supported')
    }
  }

  isStarted = true
}

/* =====================================
   QR DETECTION + FLAG ANCHOR
===================================== */

// function startDetectionLoop() {
//   if (!barcodeDetector || !nepalFlag) return

//   detectInterval = window.setInterval(async () => {
//     try {
//       const barcodes = await barcodeDetector!.detect(video)
//       const now = Date.now()

//       if (barcodes.length > 0) {
//         lastDetectedTime = now
//         const box = barcodes[0].boundingBox

//         // QR center normalized
//         const centerX = box.x + box.width / 2
//         const centerY = box.y + box.height / 2
//         const nx = centerX / video.videoWidth
//         const ny = centerY / video.videoHeight

//         // Map to AR world coordinates
//         const distance = 0.5 // meters in front of camera
//         const aspect = video.videoWidth / video.videoHeight
//         const fov = camera.fov * (Math.PI / 180)
//         const h = 2 * Math.tan(fov / 2) * distance
//         const w = h * aspect
//         const xWorld = (nx - 0.5) * w
//         const yWorld = -(ny - 0.5) * h

//         // const qrWidth = barcodes[0].boundingBox.width;
//         // const qrHeight = barcodes[0].boundingBox.height;
//         // const worldWidth = qrWidth * w * 1.2   // 1.2 → slightly bigger than QR
//         // const worldHeight = qrHeight * h * 1.2

//         const worldWidth = 0.1;   // 1.2 → slightly bigger than QR
//         const worldHeight = 0.1;

//         console.log(worldWidth, worldHeight);

//         // Rotation based on QR orientation
//         const [tl, tr] = barcodes[0].cornerPoints
//         const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x)

//         if (!nepalFlag) return;
//         // Anchor flag to QR
//         nepalFlag.mesh.position.lerp(new THREE.Vector3(xWorld, yWorld, -distance), 0.3)
//         // Scale flag to match QR size + a little bigger
//         nepalFlag.mesh.scale.set(worldWidth, worldHeight, 1)
//         nepalFlag.mesh.rotation.set(0, 0, -angle)
//         nepalFlag.mesh.visible = true
//       }

//       if (nepalFlag && (now - lastDetectedTime > detectionGracePeriod)) {
//         nepalFlag.mesh.visible = false
//       }
//     } catch (err) {
//       console.error('Detection error:', err)
//     }
//   }, 250) // slower detection for mobile
// }

function startDetectionLoop() {
  if (!barcodeDetector || !nepalFlag) return

  detectInterval = window.setInterval(async () => {
    try {
      const barcodes = await barcodeDetector!.detect(video)
      const now = Date.now()

      if (barcodes.length > 0) {
        lastDetectedTime = now
        const barcode = barcodes[0]
        const box = barcode.boundingBox

        /* ---------------------------
           1. PARSE QR JSON
        ---------------------------- */
        try {
          const parsed = JSON.parse(barcode.rawValue || '')

          if (
            parsed.anim &&
            typeof parsed.posX === 'number' &&
            typeof parsed.posY === 'number' &&
            typeof parsed.width === 'number' &&
            typeof parsed.height === 'number'
          ) {
            currentQRConfig = parsed
          }
        } catch (e) {
          console.warn('QR does not contain valid JSON')
        }

        if (!currentQRConfig) return

        /* ---------------------------
           2. ESTIMATE DISTANCE
        ---------------------------- */
        const qrPixelWidth = box.width
        const focalLength =
          video.videoWidth /
          (2 * Math.tan((camera.fov * Math.PI) / 360))

        const distance =
          (REAL_QR_SIZE * focalLength) / qrPixelWidth

        /* ---------------------------
           3. NORMALIZED CENTER
        ---------------------------- */
        const centerX = box.x + box.width / 2
        const centerY = box.y + box.height / 2

        const nx = centerX / video.videoWidth
        const ny = centerY / video.videoHeight

        const aspect = video.videoWidth / video.videoHeight
        const fov = camera.fov * (Math.PI / 180)

        const viewHeight = 2 * Math.tan(fov / 2) * distance
        const viewWidth = viewHeight * aspect

        const xWorld = (nx - 0.5) * viewWidth
        const yWorld = -(ny - 0.5) * viewHeight

        /* ---------------------------
           4. APPLY JSON OFFSETS
           (in meters relative to QR)
        ---------------------------- */
        const targetPosition = new THREE.Vector3(
          xWorld - currentQRConfig.posX,
          yWorld - currentQRConfig.posY,
          -distance
        )

        /* ---------------------------
           5. SMOOTH POSITION
        ---------------------------- */
        if (!nepalFlag) return;
        nepalFlag.mesh.position.lerp(targetPosition, 0.15)

        /* ---------------------------
           6. SCALE FROM JSON
        ---------------------------- */
        nepalFlag.mesh.scale.lerp(
          new THREE.Vector3(
            currentQRConfig.width,
            currentQRConfig.height,
            1
          ),
          0.2
        )

        /* ---------------------------
           7. ROTATION (SMOOTH)
        ---------------------------- */
        if (barcode.cornerPoints.length >= 2) {
          const [tl, tr] = barcode.cornerPoints
          const angle = Math.atan2(
            tr.y - tl.y,
            tr.x - tl.x
          )

          nepalFlag.mesh.rotation.z =
            THREE.MathUtils.lerp(
              nepalFlag.mesh.rotation.z,
              -angle,
              0.2
            )
        }

        /* ---------------------------
           8. ANIMATION SWITCHING
        ---------------------------- */
        if (currentQRConfig.anim === 'nepal_flag') {
          nepalFlag.mesh.visible = true
        } else {
          nepalFlag.mesh.visible = false
        }
      }

      /* ---------------------------
         9. HIDE IF LOST
      ---------------------------- */
      if (nepalFlag && now - lastDetectedTime > 1000) {
        nepalFlag.mesh.visible = false
      }
    } catch (err) {
      console.error('Detection error:', err)
    }
  }, 250)
}

/* =====================================
   STOP STREAM
===================================== */

function stopStream() {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(track => track.stop())
  video.srcObject = null

  recordBtn?.querySelector("div")?.classList.remove("recording");

  if (recorder && recorder.state !== "inactive") {
    recorder.stop()
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder!.mimeType })
      if (recordTimeIntervalId) clearInterval(recordTimeIntervalId);
      if (recordTime) {
        recordTime.classList.remove("show");
        recordTime.textContent = '';
      }

      if (downloadButton) {
        downloadButton.classList.add("show");
        downloadButton.href = URL.createObjectURL(blob)
        downloadButton.download = "RecordedVideo.webm"
      }
    }
  }

  if (animationId) cancelAnimationFrame(animationId)
  if (detectInterval) clearInterval(detectInterval)

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
  const canvasStream = canvas.captureStream(30) // lower FPS for mobile

  recorder = new MediaRecorder(canvasStream, {
    mimeType: 'video/webm;codecs=vp9'
  })

  recordedChunks = []

  totalRecordSeconds = 0;
  recordTimeIntervalId = startTimer();

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data)
  }

  recorder.start()
}

function pauseRecording() {
  if (recorder?.state === "recording") {
    recorder.pause();
    if (recordTimeIntervalId) clearInterval(recordTimeIntervalId);
  }
}

function resumeRecording() {
  if (recorder?.state === "paused") {
    recorder.resume();
    recordTimeIntervalId = startTimer();
  }
}

/* =====================================
   BUTTONS
===================================== */

recordBtn?.addEventListener('click', () => {
  if (!isStarted) startStream()
  else stopStream()
})

pauseBtn?.addEventListener('click', () => {
  if (!pauseBtn) return;
  if (pauseBtn.classList.contains("paused")) {
    pauseBtn.classList.remove("paused");
    resumeRecording();
  } else {
    pauseBtn.classList.add("paused");
    pauseRecording();
  }
})

function startTimer(): number {
  recordTime?.classList?.add("show");

  const id = setInterval(() => {
    totalRecordSeconds++;
    const hours = Math.floor(totalRecordSeconds / 3600)
    const minutes = Math.floor((totalRecordSeconds % 3600) / 60)
    const seconds = totalRecordSeconds % 60
    if (recordTime) {
      recordTime.textContent =
        `${String(hours).padStart(2,'0')}:` +
        `${String(minutes).padStart(2,'0')}:` +
        `${String(seconds).padStart(2,'0')}`
    }
  }, 1000)
  return id
}