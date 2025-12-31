import { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { loadModel, detectFace } from '../utils/faceDetection';
import { processImageForAnalysis, extractVisualFeatures } from '../utils/imageProcessing';
import client from '../api/client';
import './Scan.css';

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [scanMode, setScanMode] = useState<'idle' | 'positioning' | 'scanning'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<string>('');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [positionNames, setPositionNames] = useState<string[]>([]);
  const detectionStabilityRef = useRef<number>(0);
  const lastDetectionRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const init = async () => {
      await startCamera();
      // Pre-load the model
      try {
        await loadModel();
        setModelLoaded(true);
      } catch (err) {
        console.error('Failed to load model:', err);
        setError('Failed to load face detection model. Please refresh the page.');
      }
    };

    init();

    return () => {
      stopCamera();
    };
  }, [token]);

  // Real-time face detection preview with stability check
  useEffect(() => {
    if (!modelLoaded || !videoRef.current) return;

    let isRunning = true;
    let detector: any = null;
    let lastCheck = 0;
    const CHECK_INTERVAL = 500; // Check every 500ms
    const STABILITY_THRESHOLD = 2; // Need 2 consecutive detections to show as detected (reduced from 3)

    const checkFace = async () => {
      if (!isRunning) return;

      const now = Date.now();
      if (now - lastCheck < CHECK_INTERVAL) {
        setTimeout(checkFace, CHECK_INTERVAL);
        return;
      }
      lastCheck = now;

      if (!videoRef.current) {
        setTimeout(checkFace, CHECK_INTERVAL);
        return;
      }

      const video = videoRef.current;
      
      // Check if video is ready
      if (video.readyState !== 4) {
        setTimeout(checkFace, CHECK_INTERVAL);
        return;
      }

      // Check if video has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setTimeout(checkFace, CHECK_INTERVAL);
        return;
      }

      // Don't check during active scan
      if (scanMode === 'scanning') {
        setTimeout(checkFace, CHECK_INTERVAL);
        return;
      }

      try {
        if (!detector) {
          console.log('Loading detector...');
          detector = await loadModel();
          console.log('Detector loaded');
        }

        const face = await detectFace(video, detector);
        const hasFace = !!face;
        
        // Simple: if face is detected, it's ready (no positioning check)
        const currentDetection = hasFace;
        
        // Stability check: only update state if detection is stable
        if (currentDetection === lastDetectionRef.current) {
          // Same state as before, increment stability counter
          if (currentDetection) {
            detectionStabilityRef.current = Math.min(detectionStabilityRef.current + 1, STABILITY_THRESHOLD + 1);
          } else {
            detectionStabilityRef.current = Math.max(detectionStabilityRef.current - 1, -STABILITY_THRESHOLD);
          }
        } else {
          // State changed, reset stability counter
          detectionStabilityRef.current = currentDetection ? 1 : -1;
          lastDetectionRef.current = currentDetection;
        }

        // Update UI based on current state and stability
        const isStableDetected = detectionStabilityRef.current >= STABILITY_THRESHOLD;
        const isStableNotDetected = detectionStabilityRef.current <= -STABILITY_THRESHOLD;
        
        if (hasFace && isStableDetected) {
          setFaceDetected(true);
          setDebugInfo(`✅ Face detected (${face.keypoints?.length} keypoints)`);
        } else if (hasFace && !isStableDetected) {
          setFaceDetected(false);
          setDebugInfo('⏳ Detecting...');
        } else if (!hasFace && isStableNotDetected) {
          setFaceDetected(false);
          setDebugInfo('❌ No face detected');
        } else {
          setFaceDetected(false);
          setDebugInfo('⏳ Detecting...');
        }
      } catch (err) {
        console.error('Face detection error:', err);
        setFaceDetected(false);
        setDebugInfo('❌ Detection error - check console');
        detectionStabilityRef.current = 0;
      }

      setTimeout(checkFace, CHECK_INTERVAL);
    };

    // Start checking after a short delay to let video initialize
    setTimeout(checkFace, 1000);

    return () => {
      isRunning = false;
      detectionStabilityRef.current = 0;
      lastDetectionRef.current = false;
    };
  }, [modelLoaded, scanMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready
        return new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
      }
    } catch (err) {
      setError('Failed to access camera. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Play a beep sound for position changes
  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800; // Higher pitch beep
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (err) {
      console.log('Could not play beep sound:', err);
    }
  };

  // Capture current video frame as image
  const captureFrameImage = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const captureScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setError('');
    setScanMode('scanning');

    try {
      // Load model if not already loaded
      const model = await loadModel();

      // Face ID-style scanning flow
      const positions = [
        { name: 'Center', angle: 'center', progress: 0, duration: 2000 },
        { name: 'Look Left', angle: 'left', progress: 20, duration: 2000 },
        { name: 'Look Right', angle: 'right', progress: 40, duration: 2000 },
        { name: 'Look Up', angle: 'up', progress: 60, duration: 2000 },
        { name: 'Look Down', angle: 'down', progress: 80, duration: 2000 },
        { name: 'Center Again', angle: 'center', progress: 100, duration: 2000 },
      ];
      
      // Store position names for image labels
      setPositionNames(positions.map(p => p.name));

      const capturedFaces: any[] = [];
      const capturedImagesList: string[] = [];

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        setCurrentPosition(position.name);
        setScanProgress(position.progress);

        // Play beep when changing positions (except first one)
        if (i > 0) {
          playBeep();
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const startTime = Date.now();
        let bestFace: any = null;

        // During this position, continuously check for faces
        while (Date.now() - startTime < position.duration) {
          const face = await detectFace(videoRef.current, model);
          
          // For center positions, capture any detected face
          if (position.angle === 'center' && face) {
            bestFace = face; // Use the most recent face
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Capture frame image for debugging
        const frameImage = captureFrameImage();
        if (frameImage) {
          capturedImagesList.push(frameImage);
          setCapturedImages([...capturedImagesList]);
        }

        // Save center faces for final capture
        if (position.angle === 'center' && bestFace) {
          capturedFaces.push(bestFace);
        }

        // Small delay between positions
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Use the last center face (most recent)
      let face = capturedFaces[capturedFaces.length - 1] || capturedFaces[0];
      
      // If we didn't get a face, try one more time
      if (!face) {
        setCurrentPosition('Final Capture');
        setScanProgress(95);
        
        let finalFace = null;
        for (let i = 0; i < 10; i++) {
          const detected = await detectFace(videoRef.current, model);
          if (detected) {
            finalFace = detected;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (finalFace) {
          face = finalFace;
        }
      }
      
      if (!face) {
        setError('Could not capture face data. Please ensure your face is centered and well-lit, then try again.');
        setIsProcessing(false);
        setScanMode('idle');
        setScanProgress(0);
        setCurrentPosition('');
        return;
      }

      // Verify we have keypoints
      if (!face.keypoints || face.keypoints.length === 0) {
        setError('Face detected but landmarks not found. Please try again.');
        setIsProcessing(false);
        setScanMode('idle');
        return;
      }

      // Process image to normalize lighting and enhance features
      let visualFeatures = null;
      if (videoRef.current && canvasRef.current) {
        // Validate video is ready and has dimensions
        if (videoRef.current.readyState >= 2 && 
            videoRef.current.videoWidth > 0 && 
            videoRef.current.videoHeight > 0) {
          try {
            const processedCanvas = processImageForAnalysis(canvasRef.current, videoRef.current);
            
            // Extract visual features from processed image
            if (face.box && 
                face.box.width > 0 && 
                face.box.height > 0 &&
                processedCanvas.width > 0 && 
                processedCanvas.height > 0) {
              visualFeatures = extractVisualFeatures(processedCanvas, {
                xMin: face.box.xMin,
                yMin: face.box.yMin,
                width: face.box.width,
                height: face.box.height,
              });
              
              console.log('Visual features extracted:', visualFeatures);
            }
          } catch (error) {
            console.warn('Error processing image for visual features:', error);
            // Continue without visual features - not critical
          }
        } else {
          console.warn('Video not ready for image processing');
        }
      }

      // Prepare landmarks for backend AI analysis
      const landmarksData = {
        keypoints: face.keypoints.map((kp: any) => ({
          x: kp.x,
          y: kp.y,
          z: kp.z || 0,
        })),
        box: face.box ? {
          xMin: face.box.xMin,
          yMin: face.box.yMin,
          width: face.box.width,
          height: face.box.height,
        } : null,
        visualFeatures: visualFeatures, // Include processed image features
      };

      // Capture final image for AI analysis
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
      }

      // Send image to backend for ChatGPT Vision analysis
      await processDetectedFace(face, canvas);

    } catch (err: any) {
      console.error('Scan error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      const errorMessage = err.response?.data?.error || err.message || 'Failed to process scan. Please try again.';
      setError(errorMessage);
      setScanMode('idle');
      setScanProgress(0);
      setCurrentPosition('');
    } finally {
      setIsProcessing(false);
      setCountdown(0);
    }
  };

  // Handle image upload
  // Handle multiple image uploads
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: Array<{ id: string; url: string }> = [];
    let loadedCount = 0;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        const id = `${Date.now()}-${Math.random()}`;
        newImages.push({ id, url: imageUrl });
        loadedCount++;
        
        // Update state when all images are loaded
        if (loadedCount === files.length) {
          setUploadedImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Process uploaded image for face detection (deprecated - use scanUploadedImage instead)
  const processUploadedImage = async () => {
    if (uploadedImages.length === 0 || !canvasRef.current) return;

    const img = new Image();
    img.onload = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      try {
        const model = await loadModel();
        const face = await detectFaceFromCanvas(canvas, model);
        
        if (face && face.keypoints && face.keypoints.length > 0) {
          setFaceDetected(true);
          setDebugInfo(`Face detected (${face.keypoints.length} keypoints)`);
        } else {
          setFaceDetected(false);
          setDebugInfo('No face detected in uploaded image');
        }
      } catch (error) {
        console.error('Error processing uploaded image:', error);
        setError('Failed to process uploaded image');
      }
    };
    // This function is deprecated - use scanUploadedImage instead
    if (uploadedImages.length > 0) {
      img.src = uploadedImages[0].url;
    }
  };

  // Detect face from canvas (for uploaded images)
  const detectFaceFromCanvas = async (
    canvas: HTMLCanvasElement,
    detector: any
  ) => {
    try {
      const faces = await detector.estimateFaces(canvas, {
        flipHorizontal: false,
        staticImageMode: true,
      });

      if (faces && faces.length > 0) {
        return faces[0];
      }
      return null;
    } catch (error) {
      console.error('Face detection error from canvas:', error);
      return null;
    }
  };

  // Scan a specific uploaded image - sends directly to ChatGPT Vision
  const scanUploadedImage = async (imageUrl: string) => {
    if (!imageUrl) {
      setError('No image provided');
      return;
    }

    setIsProcessing(true);
    setError('');
    setScanMode('scanning');

    try {
      // Extract base64 from data URL (remove data:image/jpeg;base64, prefix)
      let base64Data = imageUrl;
      
      if (imageUrl.includes(',')) {
        base64Data = imageUrl.split(',')[1];
      }
      
      // Validate we have base64 data
      if (!base64Data || base64Data.length < 100) {
        throw new Error('Invalid image data. Please try uploading a different image.');
      }
      
      console.log('Prepared image for upload:', {
        originalLength: imageUrl.length,
        base64Length: base64Data.length,
        preview: base64Data.substring(0, 50)
      });
      
      // Send directly to backend for ChatGPT Vision analysis
      setDebugInfo('Analyzing uploaded image with ChatGPT Vision...');
      console.log('Sending uploaded image to backend for AI analysis...');
      
      const response = await client.post('/scans', {
        images: [base64Data], // Send as array of base64 images
      });

      console.log('Backend response received:', response.data);

      if (!response.data) {
        throw new Error('No data in response');
      }

      const calculatedMetrics = {
        water_retention: response.data.water_retention,
        inflammation_index: response.data.inflammation_index,
        lymph_congestion_score: response.data.lymph_congestion_score,
        facial_fat_layer: response.data.facial_fat_layer,
        definition_score: response.data.definition_score,
        potential_ceiling: response.data.potential_ceiling,
      };

      // Validate all metrics are present
      const requiredMetrics = ['water_retention', 'inflammation_index', 'lymph_congestion_score', 'facial_fat_layer', 'definition_score', 'potential_ceiling'];
      for (const metric of requiredMetrics) {
        if (calculatedMetrics[metric as keyof typeof calculatedMetrics] === undefined || calculatedMetrics[metric as keyof typeof calculatedMetrics] === null) {
          console.error(`Missing metric in response: ${metric}`, response.data);
          throw new Error(`Missing metric: ${metric}`);
        }
      }

      setMetrics(calculatedMetrics);
      setIsScanning(false);
      setScanMode('idle');
      setScanProgress(0);
      setCurrentPosition('');
      
      // Navigate to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Scan from upload error:', err);
      setError(err.response?.data?.error || 'Failed to process uploaded image. Please try again.');
      setIsProcessing(false);
      setScanMode('idle');
    } finally {
      setIsProcessing(false);
      setCountdown(0);
    }
  };

  // Extract face processing logic - now sends images to ChatGPT Vision
  const processDetectedFace = async (face: any, sourceCanvas?: HTMLCanvasElement) => {
    // Capture image from canvas or video
    let imageBase64: string | null = null;
    
    if (sourceCanvas) {
      // Use provided canvas
      imageBase64 = sourceCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Remove data:image prefix
    } else if (canvasRef.current && videoRef.current) {
      // Capture from video to canvas
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        }
      }
    }
    
    if (!imageBase64) {
      setError('Failed to capture image. Please try again.');
      setIsProcessing(false);
      setScanMode('idle');
      return;
    }

    // Save scan to backend with image
    setDebugInfo('Analyzing facial structure with ChatGPT Vision...');
    console.log('Sending image to backend for AI analysis...');
    
    const response = await client.post('/scans', {
      images: [imageBase64], // Send as array of base64 images
    });

    console.log('Backend response received:', response.data);

    if (!response.data) {
      throw new Error('No data in response');
    }

    const calculatedMetrics = {
      water_retention: response.data.water_retention,
      inflammation_index: response.data.inflammation_index,
      lymph_congestion_score: response.data.lymph_congestion_score,
      facial_fat_layer: response.data.facial_fat_layer,
      definition_score: response.data.definition_score,
      potential_ceiling: response.data.potential_ceiling,
    };

    // Validate all metrics are present
    const requiredMetrics = ['water_retention', 'inflammation_index', 'lymph_congestion_score', 'facial_fat_layer', 'definition_score', 'potential_ceiling'];
    for (const metric of requiredMetrics) {
      if (calculatedMetrics[metric as keyof typeof calculatedMetrics] === undefined || calculatedMetrics[metric as keyof typeof calculatedMetrics] === null) {
        console.error(`Missing metric in response: ${metric}`, response.data);
        throw new Error(`Missing metric: ${metric}`);
      }
    }

    setMetrics(calculatedMetrics);
    setIsScanning(false);
    setScanMode('idle');
    setScanProgress(0);
    setCurrentPosition('');
    
    // Navigate to dashboard
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  return (
    <div className="scan-container">
      <div className="scan-header">
        <h1>Face Scan</h1>
        <p>Position your face in the frame and click scan, or upload an image for testing</p>
      </div>

      {/* Image Upload Section */}
      <div className="upload-section" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #333', borderRadius: '8px', backgroundColor: '#1a1a1a' }}>
        <label htmlFor="image-upload" style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#fff' }}>
          Upload Images for Testing (Optional - Multiple images allowed)
        </label>
        <input
          ref={fileInputRef}
          id="image-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          style={{ marginBottom: '10px', color: '#fff' }}
        />
        {uploadedImages.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
              gap: '15px',
              marginBottom: '15px'
            }}>
              {uploadedImages.map((image) => (
                <div key={image.id} style={{ 
                  position: 'relative',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#2a2a2a'
                }}>
                  <img 
                    src={image.url} 
                    alt="Uploaded for testing" 
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      objectFit: 'contain',
                      maxHeight: '200px'
                    }}
                  />
                  <div style={{ padding: '8px' }}>
                    <button
                      onClick={() => scanUploadedImage(image.url)}
                      disabled={isProcessing}
                      style={{ 
                        width: '100%',
                        padding: '8px', 
                        backgroundColor: isProcessing ? '#666' : '#2196F3', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      {isProcessing ? 'Processing...' : 'Scan'}
                    </button>
                    <button
                      onClick={() => {
                        setUploadedImages(prev => prev.filter(img => img.id !== image.id));
                      }}
                      style={{ 
                        width: '100%',
                        marginTop: '5px',
                        padding: '6px', 
                        backgroundColor: '#f44336', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setUploadedImages([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#f44336', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="scan-view">
        <div className="video-wrapper">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="scan-video"
          />
          <canvas ref={canvasRef} className="scan-canvas" />
          
          {countdown > 0 && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdown}</div>
            </div>
          )}

          {scanMode === 'scanning' && (
            <div className="scanning-overlay">
              <div className="scanning-content">
                <div className="scanning-title">{currentPosition}</div>
                <div className="scanning-progress-bar">
                  <div 
                    className="scanning-progress-fill" 
                    style={{ width: `${scanProgress}%` }}
                  ></div>
                </div>
                <div className="scanning-instruction">
                  {scanProgress < 20 && 'Position your face in the center'}
                  {scanProgress >= 20 && scanProgress < 40 && 'Slowly turn your head to the left'}
                  {scanProgress >= 40 && scanProgress < 60 && 'Slowly turn your head to the right'}
                  {scanProgress >= 60 && scanProgress < 80 && 'Look up slightly'}
                  {scanProgress >= 80 && scanProgress < 100 && 'Look down slightly'}
                  {scanProgress >= 100 && 'Finalizing scan...'}
                </div>
              </div>
            </div>
          )}

        </div>

        {error && <div className="error-message">{error}</div>}

        {debugInfo && (
          <div className="debug-info">
            {debugInfo}
          </div>
        )}

        {capturedImages.length > 0 && (
          <div className="captured-images-preview">
            <h3>Captured Positions (Debug)</h3>
            <div className="images-grid">
              {capturedImages.map((img, index) => (
                <div key={index} className="captured-image-item">
                  <img src={img} alt={`Position ${index + 1}`} />
                  <div className="image-label">
                    {positionNames[index] || `Position ${index + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {metrics && (
          <div className="metrics-preview">
            <h3>Scan Complete!</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">Water Retention</span>
                <span className="metric-value">{metrics.water_retention}%</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Inflammation</span>
                <span className="metric-value">{metrics.inflammation_index}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Lymph Congestion</span>
                <span className="metric-value">{metrics.lymph_congestion_score}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Definition Score</span>
                <span className="metric-value">{metrics.definition_score}</span>
              </div>
            </div>
          </div>
        )}

        <div className="scan-controls">
          {!metrics && (
            <button
              onClick={captureScan}
              disabled={isProcessing || countdown > 0 || !modelLoaded || !faceDetected || scanMode === 'scanning'}
              className="btn-scan"
            >
              {!modelLoaded 
                ? 'Loading face detection...'
                : !faceDetected
                ? 'Waiting for face...'
                : scanMode === 'scanning'
                ? 'Scanning...'
                : isProcessing 
                ? 'Processing...'
                : 'Start Face Scan'
              }
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

