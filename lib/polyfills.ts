/**
 * Polyfills for browser-specific APIs in Node.js environment.
 * Required for pdfjs-dist / pdf-parse to function correctly in serverless functions.
 */

if (typeof globalThis !== "undefined") {
  const g = globalThis as Record<string, unknown>;
  if (!g.DOMMatrix) {
    // biome-ignore lint/complexity/noStaticOnlyClass: polyfill must mimic browser DOMMatrix class interface
    g.DOMMatrix = class DOMMatrix {
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

  if (!g.Path2D) {
    g.Path2D = class Path2D {
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

  if (!g.ImageData) {
    g.ImageData = class ImageData {
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
