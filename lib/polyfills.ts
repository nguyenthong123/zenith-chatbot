/**
 * Polyfills for browser-specific APIs in Node.js environment.
 * Required for pdfjs-dist / pdf-parse to function correctly in serverless functions.
 */

if (typeof globalThis !== "undefined") {
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      constructor() {}
      static fromMatrix() {
        return new DOMMatrix();
      }
      static fromFloat32Array() {
        return new DOMMatrix();
      }
      static fromFloat64Array() {
        return new DOMMatrix();
      }
    };
  }

  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = class Path2D {
      constructor() {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    };
  }

  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
}
