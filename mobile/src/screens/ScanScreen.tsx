import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import client from '../api/client';

type Pose = 'center' | 'left' | 'right' | 'up' | 'down';

interface Position {
  name: string;
  pose: Pose;
  progress: number;
}

export default function ScanScreen() {
  const [facing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<string>('Ready to scan');
  const [scanProgress, setScanProgress] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const navigation = useNavigation();

  const positions: Position[] = [
    { name: 'Center', pose: 'center', progress: 0 },
    { name: 'Look Left', pose: 'left', progress: 20 },
    { name: 'Look Right', pose: 'right', progress: 40 },
    { name: 'Look Up', pose: 'up', progress: 60 },
    { name: 'Look Down', pose: 'down', progress: 80 },
    { name: 'Center Again', pose: 'center', progress: 100 },
  ];

  // Request camera permission on mount
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const playBeep = () => {
    // Use vibration as audio feedback (works reliably on all devices)
    Vibration.vibrate(100); // 100ms vibration
  };

  const captureFrame = async (): Promise<string | null> => {
    if (!cameraRef.current) {
      console.error('captureFrame: cameraRef.current is null');
      return null;
    }
    try {
      // Small delay to ensure camera is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.2,
        base64: true,
      });
      if (!photo || !photo.base64 || photo.base64.length < 100) {
        console.warn('captureFrame: Photo captured but invalid (too small or missing base64)');
        return null;
      }
      return photo.base64;
    } catch (error: any) {
      // Only log if it's not a common expected error
      if (!error.message?.includes('camera') && !error.message?.includes('permission')) {
        console.error('captureFrame error:', error);
      }
      return null;
    }
  };

  const processImages = async (images: string[]) => {
    setIsProcessing(true);
    try {
      const response = await client.post('/scans', { images });

      if (response.data && response.data.id) {
        setIsScanning(false);
        setCurrentPosition('Ready to scan');
        setScanProgress(0);
        
        // Navigate to Progress tab (top of the list)
        // @ts-ignore
        navigation.navigate('Progress', {
          screen: 'ScansList',
        });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to process scan';
      if (error.response?.status === 413) {
        errorMessage = 'Images too large. Please try again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      Alert.alert('Error', errorMessage);
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
      setScanProgress(0);
      setCurrentPosition('Ready to scan');
    }
  };

  const startScanning = async () => {
    if (isScanning || isProcessing) return;

    setIsScanning(true);
    const capturedImagesList: string[] = [];

    try {
      let retries = 0;
      while (!cameraRef.current && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }
      
      if (!cameraRef.current) {
        Alert.alert('Error', 'Camera not ready. Please try again.');
        setIsScanning(false);
        return;
      }

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        let frameCaptured = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!frameCaptured && retryCount < maxRetries) {
          setCurrentPosition(position.name);
          setScanProgress(position.progress);

          if (i === 0 && retryCount === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          const frame = await captureFrame();
          
          if (frame && frame.length > 100) {
            try {
              const response = await client.post('/face-check/check', {
                image: frame,
                requiredPose: position.pose,
              });

              const result = response.data;
              const isValid = result.correctPosition === true;
              
              if (!isValid) {
                const errorMsg = result.message || `You're not in the correct position. Please ${position.name.toLowerCase()}.`;
                retryCount++;
                
                if (retryCount < maxRetries) {
                  const shouldRetry = await new Promise<boolean>((resolve) => {
                    Alert.alert(
                      'Position Not Correct',
                      `${errorMsg} Would you like to retake it?`,
                      [
                        { text: 'Retake', onPress: () => resolve(true) },
                        { text: 'Skip', style: 'cancel', onPress: () => resolve(false) },
                      ],
                      { cancelable: false }
                    );
                  });

                  if (shouldRetry) {
                    // Reset position name and progress to go back to current position
                    setCurrentPosition(position.name);
                    setScanProgress(position.progress);
                    // Small delay so user can see they're back at this position and prepare
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue; // This will restart the while loop for retry
                  } else {
                    frameCaptured = true;
                    break;
                  }
                } else {
                  Alert.alert('Max Retries Reached', `Skipping ${position.name} position after ${maxRetries} attempts.`);
                  frameCaptured = true;
                  break;
                }
              } else {
                capturedImagesList.push(frame);
                frameCaptured = true;
                
                // Update to next position after successful verification
                if (i + 1 < positions.length) {
                  setCurrentPosition(positions[i + 1].name);
                  playBeep(); // Play vibration when text changes to next position
                  // Delay after verification to give user time to see new position and prepare
                  await new Promise(resolve => setTimeout(resolve, 1500));
                } else {
                  setCurrentPosition('Processing...');
                }
              }
            } catch (error: any) {
              const isNetworkError = error.code === 'ECONNABORTED' || error.message?.includes('Network Error') || !error.response;
              capturedImagesList.push(frame);
              frameCaptured = true;
              
              // Update to next position after capture (even on error)
              if (i + 1 < positions.length) {
                setCurrentPosition(positions[i + 1].name);
                playBeep();
                // Delay after verification to give user time to see new position and prepare
                await new Promise(resolve => setTimeout(resolve, 1500));
              } else {
                setCurrentPosition('Processing...');
              }
            }
          } else {
            // Frame capture failed (returned null)
            retryCount++;
            if (retryCount < maxRetries) {
              console.warn(`Capture failed for ${position.name}, retrying... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1500)); // Longer delay on retry
            } else {
              console.error(`Failed to capture ${position.name} after ${maxRetries} attempts, skipping...`);
              Alert.alert('Capture Failed', `Could not capture image for ${position.name}. Skipping this position.`);
              frameCaptured = true;
            }
          }
        }
      }

      if (capturedImagesList.length > 0) {
        await processImages(capturedImagesList);
      } else {
        Alert.alert('Error', 'No images were captured. Please try again.');
        setIsScanning(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Scanning failed');
      setIsScanning(false);
    } finally {
      if (!isProcessing) {
        setIsScanning(false);
      }
      setScanProgress(0);
      setCurrentPosition('Ready to scan');
    }
  };

  const handleCapture = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    await startScanning();
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      />
      <View style={styles.overlay}>
        <View style={styles.statusContainer}>
          <Text style={styles.instructionText}>
            {currentPosition}
          </Text>
          {isScanning && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${scanProgress}%` }]} />
            </View>
          )}
        </View>
      </View>
      <View style={styles.cameraControls}>
        {!isScanning && !isProcessing ? (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
          />
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setIsScanning(false);
              setCurrentPosition('Ready to scan');
            }}
          >
            <Text style={styles.buttonText}>Cancel Scan</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    padding: 20,
  },
  statusContainer: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 50,
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40, // Extra padding for bottom tab bar
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    // Removed - no inner circle needed
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 150,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
});

