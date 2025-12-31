/**
 * Image processing utilities to enhance facial analysis
 * Normalizes lighting and enhances features for better detection
 */

/**
 * Process image to normalize lighting and enhance features
 */
export function processImageForAnalysis(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement
): HTMLCanvasElement {
  // Validate video dimensions
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    console.warn('Video has no dimensions, returning original canvas');
    return canvas;
  }

  const processedCanvas = document.createElement('canvas');
  processedCanvas.width = video.videoWidth;
  processedCanvas.height = video.videoHeight;
  const ctx = processedCanvas.getContext('2d');
  
  if (!ctx) {
    console.warn('Could not get 2d context, returning original canvas');
    return canvas;
  }

  // Draw original video frame
  try {
    ctx.drawImage(video, 0, 0);
  } catch (error) {
    console.warn('Error drawing video to canvas:', error);
    return canvas;
  }

  // Validate canvas dimensions before processing
  if (processedCanvas.width === 0 || processedCanvas.height === 0) {
    console.warn('Processed canvas has zero dimensions, returning original');
    return canvas;
  }

  // Get image data
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
  } catch (error) {
    console.warn('Error getting image data:', error);
    return canvas;
  }
  const data = imageData.data;

  // Apply processing filters
  const processedData = new Uint8ClampedArray(data);

  // 1. Normalize lighting (histogram equalization for better contrast)
  normalizeLighting(processedData, processedCanvas.width, processedCanvas.height);

  // 2. Enhance edges (helps detect jaw definition, facial structure)
  enhanceEdges(processedData, processedCanvas.width, processedCanvas.height);

  // 3. Reduce noise while preserving edges
  reduceNoise(processedData, processedCanvas.width, processedCanvas.height);

  // Put processed data back
  const processedImageData = new ImageData(processedData, processedCanvas.width, processedCanvas.height);
  ctx.putImageData(processedImageData, 0, 0);

  return processedCanvas;
}

/**
 * Normalize lighting using adaptive histogram equalization
 * Reduces lighting variations that could affect measurements
 */
function normalizeLighting(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  // Calculate luminance for each pixel
  const luminance = new Float32Array(width * height);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Calculate luminance (perceived brightness)
    luminance[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Calculate local average luminance (adaptive)
  const blockSize = Math.min(32, Math.floor(width / 10));
  const localAvg = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -blockSize; dy <= blockSize; dy++) {
        for (let dx = -blockSize; dx <= blockSize; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += luminance[ny * width + nx];
            count++;
          }
        }
      }

      localAvg[y * width + x] = sum / count;
    }
  }

  // Normalize based on local average
  const targetLuminance = 128; // Target middle gray
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const localLum = localAvg[idx];
    const currentLum = luminance[idx];
    
    if (localLum > 0) {
      const ratio = targetLuminance / localLum;
      const newLum = currentLum * ratio;
      const scale = newLum / currentLum;

      data[i] = Math.min(255, Math.max(0, data[i] * scale));     // R
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * scale)); // G
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * scale)); // B
    }
  }
}

/**
 * Enhance edges using Sobel operator
 * Helps detect jaw definition and facial structure
 */
function enhanceEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  // Convert to grayscale first
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Sobel edge detection
  const sobelX = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ];
  const sobelY = [
    -1, -2, -1,
     0,  0,  0,
     1,  2,  1
  ];

  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += gray[idx] * sobelX[kernelIdx];
          gy += gray[idx] * sobelY[kernelIdx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude;
    }
  }

  // Enhance edges in original image (subtle enhancement)
  const edgeStrength = 0.3; // How much to enhance edges
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const edge = edges[idx] / 255; // Normalize to 0-1
    
    // Enhance edges slightly
    const enhance = 1 + (edge * edgeStrength);
    data[i] = Math.min(255, Math.max(0, data[i] * enhance));     // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * enhance)); // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * enhance)); // B
  }
}

/**
 * Reduce noise using simple median filter
 * Preserves edges while reducing noise
 */
function reduceNoise(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const filtered = new Uint8ClampedArray(data);
  const radius = 1; // Small radius to preserve detail

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) { // R, G, B channels
        const values: number[] = [];
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            values.push(data[idx]);
          }
        }

        // Median filter
        values.sort((a, b) => a - b);
        const median = values[Math.floor(values.length / 2)];
        
        const idx = (y * width + x) * 4 + c;
        filtered[idx] = median;
      }
    }
  }

  // Copy filtered data back
  for (let i = 0; i < data.length; i++) {
    data[i] = filtered[i];
  }
}

/**
 * Extract features for analysis (water retention, inflammation indicators)
 */
export function extractVisualFeatures(
  canvas: HTMLCanvasElement,
  faceBox: { xMin: number; yMin: number; width: number; height: number }
): {
  cheekPuffiness: number;
  jawDefinition: number;
  skinTexture: number;
} {
  // Validate canvas dimensions
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    console.warn('Canvas has zero dimensions, returning default features');
    return { cheekPuffiness: 0, jawDefinition: 0, skinTexture: 0 };
  }

  // Validate face box
  if (!faceBox || faceBox.width <= 0 || faceBox.height <= 0) {
    console.warn('Invalid face box dimensions, returning default features');
    return { cheekPuffiness: 0, jawDefinition: 0, skinTexture: 0 };
  }

  // Clamp face box to canvas bounds
  const xMin = Math.max(0, Math.min(faceBox.xMin, canvas.width - 1));
  const yMin = Math.max(0, Math.min(faceBox.yMin, canvas.height - 1));
  const width = Math.max(1, Math.min(faceBox.width, canvas.width - xMin));
  const height = Math.max(1, Math.min(faceBox.height, canvas.height - yMin));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { cheekPuffiness: 0, jawDefinition: 0, skinTexture: 0 };
  }

  let imageData;
  try {
    imageData = ctx.getImageData(xMin, yMin, width, height);
  } catch (error) {
    console.warn('Error getting image data for visual features:', error);
    return { cheekPuffiness: 0, jawDefinition: 0, skinTexture: 0 };
  }
  const data = imageData.data;

  // Analyze cheek area (upper portion of face box)
  const cheekArea = {
    x: Math.floor(faceBox.width * 0.2),
    y: Math.floor(faceBox.height * 0.1),
    width: Math.floor(faceBox.width * 0.6),
    height: Math.floor(faceBox.height * 0.4),
  };

  // Analyze jaw area (lower portion of face box)
  const jawArea = {
    x: Math.floor(faceBox.width * 0.25),
    y: Math.floor(faceBox.height * 0.6),
    width: Math.floor(faceBox.width * 0.5),
    height: Math.floor(faceBox.height * 0.3),
  };

  // Calculate variance (texture analysis)
  const cheekVariance = calculateVariance(data, cheekArea, faceBox.width);
  const jawVariance = calculateVariance(data, jawArea, faceBox.width);

  // Higher variance in jaw = more definition (more edges/texture)
  // Lower variance in cheeks = more puffy (smoother, less texture)
  const jawDefinition = Math.min(1, jawVariance / 50); // Normalize
  const cheekPuffiness = Math.min(1, 1 - (cheekVariance / 30)); // Inverse

  // Overall skin texture (smoothness indicator)
  const skinTexture = calculateTextureSmoothness(data, faceBox.width, faceBox.height);

  return {
    cheekPuffiness,
    jawDefinition,
    skinTexture,
  };
}

/**
 * Calculate variance in a region (texture analysis)
 */
function calculateVariance(
  data: Uint8ClampedArray,
  area: { x: number; y: number; width: number; height: number },
  stride: number
): number {
  const values: number[] = [];

  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      const idx = (y * stride + x) * 4;
      const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      values.push(luminance);
    }
  }

  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  return variance;
}

/**
 * Calculate texture smoothness (lower = smoother = more puffy)
 */
function calculateTextureSmoothness(
  data: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let totalVariance = 0;
  let count = 0;

  // Sample regions across the face
  for (let y = 1; y < height - 1; y += 5) {
    for (let x = 1; x < width - 1; x += 5) {
      const idx = (y * width + x) * 4;
      const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      
      const neighbors = [
        data[((y - 1) * width + x) * 4],
        data[((y + 1) * width + x) * 4],
        data[(y * width + (x - 1)) * 4],
        data[(y * width + (x + 1)) * 4],
      ];

      const neighborAvg = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
      const diff = Math.abs(center - neighborAvg);
      totalVariance += diff;
      count++;
    }
  }

  return count > 0 ? totalVariance / count : 0;
}

