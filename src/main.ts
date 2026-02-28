import './style.css'
import * as THREE from 'three'

/* =====================================
   GLOBAL STATE
===================================== */

let lastDetectedTime = 0
const detectionGracePeriod = 300 // milliseconds

let isStarted = false
let animationId: number | null = null
let detectInterval: number | null = null

let barcodeDetector: BarcodeDetector | null = null

if ("BarcodeDetector" in globalThis) {
  barcodeDetector = new BarcodeDetector({
    formats: ["qr_code"],
  })
} else {
  console.warn("BarcodeDetector not supported in this browser.")
}

const video = document.getElementById("video") as HTMLVideoElement
const canvas = document.getElementById("overlay") as HTMLCanvasElement

/* =====================================
   THREE SETUP
===================================== */

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true
})

const scene = new THREE.Scene()

let camera: THREE.OrthographicCamera
let cube: THREE.Mesh | null = null
let cubeEdges: THREE.LineSegments | null = null

function setupThree(width: number, height: number) {
  canvas.width = width
  canvas.height = height

  renderer.setSize(width, height, false)

  camera = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    1000
  )

  camera.position.z = 100
  camera.updateProjectionMatrix()

  // Cube
  const geometry = new THREE.BoxGeometry(80, 80, 80)
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  cube = new THREE.Mesh(geometry, material)
  cube.visible = false
  cube.rotation.set(0.4, 0.2, 0)
  scene.add(cube)

  // Cube edges (black border)
  const edgesGeometry = new THREE.EdgesGeometry(geometry)
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
  cubeEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial)
  cubeEdges.visible = false
  scene.add(cubeEdges)
}

/* =====================================
   VIDEO → WORLD CONVERSION
===================================== */

function videoToWorld(x: number, y: number) {
  const worldX = x - canvas.width / 2
  const worldY = -(y - canvas.height / 2)
  return { worldX, worldY }
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

    // Sync edges with cube
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
   QR DETECTION LOOP
===================================== */

function startDetectionLoop() {
  if (!barcodeDetector) return

  detectInterval = window.setInterval(async () => {
    try {
      const barcodes = await barcodeDetector!.detect(video)
      const now = Date.now()

      if (barcodes.length > 0) {
        const box = barcodes[0].boundingBox
        lastDetectedTime = now   // ✅ update global time

        const centerX = box.x + box.width / 2
        const centerY = box.y + box.height / 2
        const { worldX, worldY } = videoToWorld(centerX, centerY)

        if (cube && cubeEdges) {
          cube.visible = true
          cubeEdges.visible = true

          cube.position.lerp(
            new THREE.Vector3(worldX, worldY, 0),
            0.3
          )

          const scale = box.width / 120
          cube.scale.set(scale, scale, scale)
        }
      }

      // ⚡ Only hide cube if QR not seen for a while
      if (now - lastDetectedTime > detectionGracePeriod) {
        if (cube && cubeEdges) {
          cube.visible = false
          cubeEdges.visible = false
        }
      }

    } catch (err) {
      console.error("Detection error:", err)
    }
  }, 100)
}

/* =====================================
   CAMERA STREAM
===================================== */

async function startStream() {
  if (isStarted) return

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
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

  isStarted = true
}

/* =====================================
   STOP STREAM
===================================== */

function stopStream() {
  const stream = video.srcObject as MediaStream | null
  stream?.getTracks().forEach(track => track.stop())

  if (animationId) cancelAnimationFrame(animationId)
  if (detectInterval) clearInterval(detectInterval)

  if (cube && cubeEdges) {
    cube.visible = false
    cubeEdges.visible = false
  }

  isStarted = false
}

/* =====================================
   BUTTONS
===================================== */

document.getElementById("stbtn")?.addEventListener("click", () => {
  if (!isStarted) startStream()
})

document.getElementById("btn")?.addEventListener("click", () => {
  if (isStarted) stopStream()
})