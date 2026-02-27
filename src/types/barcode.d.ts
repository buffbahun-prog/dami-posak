interface BarcodeDetectorOptions {
    formats?: string[];
  }
  
  interface DetectedBarcode {
    boundingBox: DOMRectReadOnly;
    rawValue: string;
    format: string;
    cornerPoints: { x: number; y: number }[];
  }
  
  declare class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
    static getSupportedFormats(): Promise<string[]>;
  }