import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

let model: faceLandmarksDetection.FaceLandmarksDetector | null = null;

export async function loadModel() {
  if (model) {
    console.log('Model already loaded');
    return model;
  }

  console.log('Loading face detection model...');

  try {
    // Try tfjs runtime first (faster, works offline)
    console.log('Attempting to load with tfjs runtime...');
    model = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1,
      }
    );
    console.log('Model loaded successfully with tfjs runtime');
    return model;
  } catch (error) {
    console.warn('tfjs runtime failed, trying mediapipe runtime:', error);
    
    try {
      // Fallback to mediapipe runtime (requires CDN)
      model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
          refineLandmarks: true,
          maxFaces: 1,
        }
      );
      console.log('Model loaded successfully with mediapipe runtime');
      return model;
    } catch (fallbackError) {
      console.error('Both runtimes failed:', fallbackError);
      throw new Error('Failed to load face detection model. Please refresh the page.');
    }
  }
}

// Helper to capture video frame to canvas
function captureFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Could not get canvas context');
      return null;
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch (error) {
    console.error('Error capturing frame:', error);
    return null;
  }
}

// Check if face is properly positioned - very simple: just make sure it's not at the edges
export function isFacePositioned(face: any, videoWidth: number, videoHeight: number): boolean {
  if (!face || !face.box) {
    return false;
  }

  const box = face.box;
  
  // Validate box dimensions
  if (box.width <= 0 || box.height <= 0) {
    return false;
  }

  // Calculate face center
  const centerX = box.xMin + box.width / 2;
  const centerY = box.yMin + box.height / 2;
  
  // Very simple check: just make sure face isn't all the way at the edges
  // Face center should be within 10% to 90% of video width/height (not at edges)
  const xPercent = centerX / videoWidth;
  const yPercent = centerY / videoHeight;
  
  // Face is positioned if it's not at the very edges (10% margin from edges)
  const isNotAtEdges = xPercent > 0.10 && xPercent < 0.90 && 
                       yPercent > 0.10 && yPercent < 0.90;
  
  // Also check that face isn't too small (at least 15% of frame) or too large (max 85%)
  const faceWidthRatio = box.width / videoWidth;
  const faceHeightRatio = box.height / videoHeight;
  const isReasonableSize = faceWidthRatio > 0.15 && faceWidthRatio < 0.85 &&
                           faceHeightRatio > 0.15 && faceHeightRatio < 0.85;
  
  return isNotAtEdges && isReasonableSize;
}

export async function detectFace(
  video: HTMLVideoElement,
  detector: faceLandmarksDetection.FaceLandmarksDetector
) {
  try {
    // Ensure video is ready
    if (!video || video.readyState !== 4) {
      console.warn('Video not ready, state:', video?.readyState);
      return null;
    }

    // Ensure video has dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('Video has no dimensions:', video.videoWidth, 'x', video.videoHeight);
      return null;
    }

    // Try detecting directly from video
    let faces = await detector.estimateFaces(video, {
      flipHorizontal: false,
      staticImageMode: false,
    });

    // If no faces, try with static image mode using a captured frame
    if (!faces || faces.length === 0) {
      const canvas = captureFrame(video);
      if (canvas) {
        faces = await detector.estimateFaces(canvas, {
          flipHorizontal: false,
          staticImageMode: true,
        });
      }
    }

    if (faces && faces.length > 0) {
      const face = faces[0];

      // Return face if it has keypoints OR if it has a bounding box (some models might not have keypoints immediately)
      if (face.keypoints && face.keypoints.length > 0) {
        return face;
      } else if (face.box) {
        // If we have a box but no keypoints, still return it (keypoints might be added later)
        console.warn('Face detected but no keypoints yet');
        return face;
      }
    }

    return null;
  } catch (error) {
    console.error('Face detection error:', error);
    return null;
  }
}

export function calculateMetrics(landmarks: any) {
  if (!landmarks || !landmarks.keypoints) {
    return null;
  }

  const keypoints = landmarks.keypoints;
  
  // Helper to calculate distance between two points
  const distance = (p1: any, p2: any) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper to get point by index
  const getPoint = (index: number) => keypoints[index];

  // Key landmark indices (MediaPipe Face Mesh)
  // Face width (cheek to cheek)
  const leftCheek = getPoint(234); // Left cheek
  const rightCheek = getPoint(454); // Right cheek
  const faceWidth = distance(leftCheek, rightCheek);

  // Face height (forehead to chin)
  const forehead = getPoint(10); // Forehead
  const chin = getPoint(152); // Chin
  const faceHeight = distance(forehead, chin);

  // Eye area measurements
  const leftEyeOuter = getPoint(33);
  const leftEyeInner = getPoint(133);
  const rightEyeOuter = getPoint(362);
  const rightEyeInner = getPoint(263);
  const eyeWidth = (distance(leftEyeOuter, leftEyeInner) + distance(rightEyeOuter, rightEyeInner)) / 2;

  // Jaw measurements
  const jawLeft = getPoint(172);
  const jawRight = getPoint(397);
  const jawWidth = distance(jawLeft, jawRight);

  // Cheek puffiness (distance from cheek to eye)
  const leftCheekToEye = distance(leftCheek, leftEyeOuter);
  const rightCheekToEye = distance(rightCheek, rightEyeOuter);
  const avgCheekToEye = (leftCheekToEye + rightCheekToEye) / 2;

  // Calculate metrics based on ratios and measurements
  const faceRatio = faceWidth / faceHeight;
  const eyeToFaceRatio = eyeWidth / faceWidth;
  const jawToFaceRatio = jawWidth / faceWidth;
  const cheekPuffinessRatio = avgCheekToEye / faceHeight;

  // Water Retention % (based on cheek puffiness and face roundness)
  const waterRetention = Math.min(100, Math.max(0, 
    (cheekPuffinessRatio * 200 - 0.2) * 100
  ));

  // Inflammation Index (based on face width expansion relative to baseline)
  // For MVP, using relative measurements
  const inflammationIndex = Math.min(100, Math.max(0,
    ((faceWidth / faceHeight) - 0.7) * 200
  ));

  // Lymph Congestion Score (based on jaw and neck area)
  const lymphCongestion = Math.min(100, Math.max(0,
    (jawToFaceRatio - 0.6) * 250
  ));

  // Facial Fat Layer % (based on overall face roundness)
  const facialFatLayer = Math.min(100, Math.max(0,
    (faceRatio - 0.65) * 300
  ));

  // Definition Score (inverse of puffiness, higher is better)
  const definitionScore = Math.min(100, Math.max(0,
    100 - (waterRetention * 0.6 + inflammationIndex * 0.4)
  ));

  // Potential Ceiling (based on definition and structure)
  const potentialCeiling = Math.min(100, Math.max(0,
    definitionScore + (100 - facialFatLayer) * 0.3
  ));

  return {
    water_retention: Math.round(waterRetention * 10) / 10,
    inflammation_index: Math.round(inflammationIndex * 10) / 10,
    lymph_congestion_score: Math.round(lymphCongestion * 10) / 10,
    facial_fat_layer: Math.round(facialFatLayer * 10) / 10,
    definition_score: Math.round(definitionScore * 10) / 10,
    potential_ceiling: Math.round(potentialCeiling * 10) / 10,
  };
}

