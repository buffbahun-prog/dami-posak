import './style.css'

// const appRoot = document.querySelector<HTMLDivElement>('#app');

let isStarted = false;

let barcodeDetector: BarcodeDetector | null = null;

if (!("BarcodeDetector" in globalThis)) {
  console.log("Barcode Detector is not supported by this browser.");
} else {
  console.log("Barcode Detector supported!");

  // create new detector
  barcodeDetector = new BarcodeDetector({
    formats: ["qr_code"],
  });
}

const video = document.getElementById('video') as HTMLVideoElement;
const canvas = document.getElementById('overlay') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
// canvas.width = video.videoWidth;
// canvas.height = video.videoHeight;

function draw(barcode: DetectedBarcode) {
  // Clear previous frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { x, y, width, height } = barcode.boundingBox;
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
}

function startStream() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }) // Use the rear camera
    .then(stream => {
        if (video) {
        video.srcObject = stream;
        video.play();
        video.addEventListener('loadeddata', () => onVideoLoaded(stream));
      }
    })
    .catch(err => {
        console.error('Error accessing camera:', err);
});
}

let decoding = false;

function onVideoLoaded(stream: MediaStream) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  requestAnimationFrame(() => startDecoding(stream));
}

let animationId: number | null = null;

async function startDecoding(stream: MediaStream) {
        if (decoding) return;
        decoding = true;
        // console.log("here");
        try {
            if (!barcodeDetector || !video) return;
            const barcodes = await barcodeDetector.detect(video); // Pass the video element directly
            // console.log("inside");
            barcodes.forEach(barcode => {
                // console.log('Barcode detected:', barcode.rawValue, barcode);
                draw(barcode);
            });
            if (stream.getTracks().every(trk => trk.readyState === "ended") && animationId) {
              cancelAnimationFrame(animationId);
            }
            animationId = requestAnimationFrame(() => startDecoding(stream));
            console.log(animationId);
        } catch (e) {
            console.error('Barcode detection failed:', e);
        } finally {
            decoding = false;
        }
}

const stopBtn = document.getElementById("btn");

stopBtn?.addEventListener("click", () => {
  if (!isStarted) return;
  const srcObj = video?.srcObject as MediaStream | null | undefined;
  srcObj?.getTracks()?.forEach(trk => trk.stop());
  isStarted = false;
  if (animationId) cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
})

const startBtn = document.getElementById("stbtn");

startBtn?.addEventListener("click", () => {
  if (isStarted) return;
  startStream();
  isStarted = true;
})