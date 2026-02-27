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

const video = document.getElementById('video') as HTMLVideoElement | null;

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
  startDecoding(stream);
}

function startDecoding(stream: MediaStream) {
    // Scan every 100 milliseconds (adjust as needed)
    const intervalId = setInterval(async () => {
        if (decoding) return;
        decoding = true;
        console.log("here");
        try {
            if (!barcodeDetector || !video) return;
            const barcodes = await barcodeDetector.detect(video); // Pass the video element directly
            barcodes.forEach(barcode => {
                console.log('Barcode detected:', barcode.rawValue);
                stream.getTracks().forEach(trk => trk.stop());
                // Process the result here
            });
            if (stream.getTracks().every(trk => trk.readyState === "ended")) {
              clearInterval(intervalId);
            }
        } catch (e) {
            console.error('Barcode detection failed:', e);
        } finally {
            decoding = false;
        }
    }, 100);
}

const stopBtn = document.getElementById("btn");

stopBtn?.addEventListener("click", () => {
  if (!isStarted) return;
  const srcObj = video?.srcObject as MediaStream | null | undefined;
  srcObj?.getTracks()?.forEach(trk => trk.stop());
  console.log(srcObj?.getTracks());
  isStarted = false;
})

const startBtn = document.getElementById("stbtn");

startBtn?.addEventListener("click", () => {
  if (isStarted) return;
  startStream();
  isStarted = true;
})