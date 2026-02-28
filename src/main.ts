import './style.css'
import * as THREE from 'three'

/* =====================================
   GLOBAL STATE
===================================== */

let lastDetectedTime = 0
const detectionGracePeriod = 500 // ms
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

/* =====================================
   THREE + WebXR SETUP
===================================== */

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
renderer.xr.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()

let camera: THREE.PerspectiveCamera
let cube: THREE.Mesh | null = null
let cubeEdges: THREE.LineSegments | null = null

function setupThree(width: number, height: number) {
  camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
  camera.position.set(0, 0, 0)
  scene.add(camera)

  // Cube
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  cube = new THREE.Mesh(geometry, material)
  cube.visible = false
  scene.add(cube)

  // Cube edges
  const edgesGeometry = new THREE.EdgesGeometry(geometry)
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000 })
  cubeEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
  cubeEdges.visible = false
  scene.add(cubeEdges)
}

/* =====================================
   RENDER LOOP
===================================== */

function startRenderLoop() {
  function render() {
    // Rotate cube continuously
    if (cube) {
      cube.rotation.x += 0.01
      cube.rotation.y += 0.01
    }

    // Sync edges
    if (cube && cubeEdges) {
      cubeEdges.position.copy(cube.position)
      cubeEdges.rotation.copy(cube.rotation)
      cubeEdges.scale.copy(cube.scale)
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

  setupThree(video.videoWidth, video.videoHeight)
  startRenderLoop()
  startDetectionLoop()

  // Start WebXR AR session
  if (navigator.xr) {
    const supported = await navigator.xr.isSessionSupported('immersive-ar')
    if (supported) {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
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
   QR DETECTION + HIT TEST
===================================== */

function startDetectionLoop() {
  if (!barcodeDetector) return

  detectInterval = window.setInterval(async () => {
    try {
      const barcodes = await barcodeDetector!.detect(video)
      const now = Date.now()

      if (barcodes.length > 0) {
        lastDetectedTime = now
        const box = barcodes[0].boundingBox

        // Convert QR center to normalized coordinates (0..1)
        const centerX = box.x + box.width / 2
        const centerY = box.y + box.height / 2
        const nx = centerX / video.videoWidth
        const ny = centerY / video.videoHeight

        // Map to AR world coordinates in front of camera
        if (cube && cubeEdges) {
          const distance = 0.5 // meters in front of camera
          // const baseCubeSize = 0.15 // default cube size in meters
          const aspect = video.videoWidth / video.videoHeight
          const fov = camera.fov * (Math.PI / 180)
          const h = 2 * Math.tan(fov / 2) * distance
          const w = h * aspect
          const xWorld = (nx - 0.5) * w
          const yWorld = -(ny - 0.5) * h

          cube.visible = true
          cubeEdges.visible = true

          // Smooth movement
          cube.position.lerp(new THREE.Vector3(xWorld, yWorld, -distance), 0.3)
        }
      }

      if (now - lastDetectedTime > detectionGracePeriod) {
        if (cube && cubeEdges) {
          cube.visible = false
          cubeEdges.visible = false
        }
      }
    } catch (err) {
      console.error('Detection error:', err)
    }
  }, 100)
}

/* =====================================
   STOP STREAM
===================================== */

function stopStream() {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(track => track.stop())
  video.srcObject = null

  if (animationId) cancelAnimationFrame(animationId)
  if (detectInterval) clearInterval(detectInterval)

  if (cube && cubeEdges) {
    cube.visible = false
    cubeEdges.visible = false
  }

  renderer.clear()
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

  isStarted = false
}

/* =====================================
   BUTTONS
===================================== */

document.getElementById('stbtn')?.addEventListener('click', () => {
  if (!isStarted) startStream()
})

document.getElementById('btn')?.addEventListener('click', () => {
  if (isStarted) stopStream()
})