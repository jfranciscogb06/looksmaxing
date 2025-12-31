import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import { format } from 'date-fns';
import { Audio } from 'expo-av';

interface Scan {
  id: number;
  scan_date: string;
  water_retention: number;
  inflammation_index: number;
  lymph_congestion_score: number;
  facial_fat_layer: number;
  definition_score: number;
}

type Pose = 'center' | 'left' | 'right' | 'up' | 'down';

interface Position {
  name: string;
  pose: Pose;
  progress: number;
}

function MetricCard({
  label,
  value,
  unit = '',
  trend,
}: {
  label: string;
  value: number;
  unit?: string;
  trend: 'up' | 'down';
}) {
  const getStatus = (val: number, trend: 'up' | 'down') => {
    if (trend === 'down') {
      if (val < 25) return { text: 'EXCELLENT', color: '#4CAF50' };
      if (val < 40) return { text: 'GOOD', color: '#8BC34A' };
      if (val < 60) return { text: 'MODERATE', color: '#FF9800' };
      return { text: 'NEEDS WORK', color: '#F44336' };
    } else {
      if (val > 75) return { text: 'EXCELLENT', color: '#4CAF50' };
      if (val > 60) return { text: 'GOOD', color: '#8BC34A' };
      if (val > 40) return { text: 'MODERATE', color: '#FF9800' };
      return { text: 'NEEDS WORK', color: '#F44336' };
    }
  };

  const status = getStatus(value, trend);

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value.toFixed(1)}
        {unit}
      </Text>
      <Text style={[styles.metricStatus, { color: status.color }]}>
        {status.text}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [facing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceStatus, setFaceStatus] = useState<string>('Ready');
  const [faceDetected, setFaceDetected] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    return null;
  }
  
  const { logout } = authContext;

  const positions: Position[] = [
    { name: 'Center', pose: 'center', progress: 0 },
    { name: 'Look Left', pose: 'left', progress: 20 },
    { name: 'Look Right', pose: 'right', progress: 40 },
    { name: 'Look Up', pose: 'up', progress: 60 },
    { name: 'Look Down', pose: 'down', progress: 80 },
    { name: 'Center Again', pose: 'center', progress: 100 },
  ];

  const playBeep = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSdTgwOUKzn8LZjGwU7kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBtpvfDknU4MDlCs5/C2YxsFO5HX8sx5LAUkd8fw3ZBAC' },
        { shouldPlay: true }
      );
      await sound.unloadAsync();
    } catch (error) {
      // Ignore beep errors
    }
  };

  const captureFrame = async (): Promise<string | null> => {
    console.log('captureFrame called, cameraRef.current:', !!cameraRef.current);
    if (!cameraRef.current) {
      console.error('captureFrame: cameraRef.current is null - camera not ready');
      return null;
    }
    try {
      console.log('Calling takePictureAsync with lower quality...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.2, // Reduced quality to make images much smaller
        base64: true,
      });
      console.log('takePictureAsync returned, photo:', !!photo, 'base64:', !!photo?.base64, 'base64 length:', photo?.base64?.length);
      if (!photo || !photo.base64) {
        console.error('captureFrame: photo or base64 is null', { photo: !!photo, base64: !!photo?.base64 });
        return null;
      }
      if (photo.base64.length < 100) {
        console.error('captureFrame: base64 too short:', photo.base64.length);
        return null;
      }
      console.log('captureFrame: SUCCESS, returning base64 string');
      return photo.base64;
    } catch (error: any) {
      console.error('captureFrame error:', error);
      console.error('Error details:', error.message, error.stack);
      return null;
    }
  };

  const startScanning = async () => {
    if (isScanning || isProcessing) {
      console.log('startScanning: already scanning or processing');
      return;
    }

    console.log('startScanning: Starting scan process');
    setIsScanning(true);
    const capturedImagesList: string[] = [];
    let shouldStop = false;

    try {
      // Wait for camera to be ready - check multiple times
      let retries = 0;
      while (!cameraRef.current && retries < 10) {
        console.log(`Waiting for camera ref, attempt ${retries + 1}/10`);
        await new Promise(resolve => setTimeout(resolve, 200));
        retries++;
      }
      
      if (!cameraRef.current) {
        console.error('startScanning: Camera ref still null after waiting');
        Alert.alert('Error', 'Camera not ready. Please try again.');
        setIsScanning(false);
        return;
      }

      console.log('Camera ref is ready, starting position loop');

      // Loop through all positions and capture each one
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        let frameCaptured = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!frameCaptured && retryCount < maxRetries) {
          console.log(`[${position.name}] Starting capture (${i + 1}/${positions.length})${retryCount > 0 ? ` - Retry ${retryCount}/${maxRetries - 1}` : ''}`);
          setCurrentPosition(position.name);
          setScanProgress(position.progress);
          setFaceStatus(retryCount > 0 ? `Retaking ${position.name}...` : `Capturing ${position.name}...`);

          if (i > 0 || retryCount > 0) {
            await playBeep();
          } else if (i === 0 && retryCount === 0) {
            // Delay on initial center position (first capture only)
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          console.log(`[${position.name}] Attempting to capture frame...`);
          const frame = await captureFrame();
          console.log(`[${position.name}] Capture result:`, frame ? `success (${frame.length} bytes)` : 'failed');
          
          if (frame && frame.length > 100) {
            // Immediately show next position in display (independent of verification)
            // If this is the last position (Center Again), show "Processing" instead
            if (i + 1 < positions.length) {
              setCurrentPosition(positions[i + 1].name);
            } else {
              setCurrentPosition('Processing...');
            }
            
            // Check if face is detected in this captured image (still verify, just display changed)
            console.log(`[${position.name}] Checking for face...`);
            setFaceStatus(`Checking ${position.name} for face...`);
            
            try {
              const response = await client.post('/face-check/check', {
                image: frame,
                requiredPose: position.pose, // Use pose ('left', 'right', etc.) not name ('Look Left', etc.)
              });

              const result = response.data;
              // Check if user is in correct position
              const isValid = result.correctPosition === true;
              
              if (!isValid) {
                // Use the message from the AI or a default message
                const errorMsg = result.message || `You're not in the correct position. Please ${position.name.toLowerCase()}.`;
                
                console.log(`[${position.name}] Validation failed:`, { correctPosition: result.correctPosition, message: result.message });
                retryCount++;
                
                // Reset display back to current position if we need to retry
                setCurrentPosition(position.name);
                
                if (retryCount < maxRetries) {
                  // Ask user if they want to retake
                  const shouldRetry = await new Promise<boolean>((resolve) => {
                    Alert.alert(
                      'Position Not Correct',
                      `${errorMsg} Would you like to retake it?`,
                      [
                        {
                          text: 'Retake',
                          onPress: () => resolve(true),
                        },
                        {
                          text: 'Skip',
                          style: 'cancel',
                          onPress: () => resolve(false),
                        },
                      ],
                      { cancelable: false }
                    );
                  });

                  if (shouldRetry) {
                    setFaceStatus(`Retaking ${position.name}...`);
                    continue; // Retry this position
                  } else {
                    // User chose to skip, continue to next position
                    frameCaptured = true; // Mark as "captured" (skipped) to move on
                    break;
                  }
                } else {
                  // Max retries reached, skip this position
                  Alert.alert('Max Retries Reached', `Skipping ${position.name} position after ${maxRetries} attempts.`);
                  frameCaptured = true; // Mark as "captured" (skipped) to move on
                  break;
                }
              } else {
                // Face detected, add to list
                capturedImagesList.push(frame);
                setFaceStatus(`✓ ${position.name} captured`);
                console.log(`[${position.name}] ✓ IMAGE CAPTURED AND ADDED (total: ${capturedImagesList.length})`);
                frameCaptured = true;
              }
            } catch (error: any) {
              console.error(`[${position.name}] Face check error:`, error);
              
              // Check if it's a network error
              const isNetworkError = error.code === 'ECONNABORTED' || error.message?.includes('Network Error') || !error.response;
              
              if (isNetworkError) {
                setFaceStatus(`Network error checking ${position.name} - continuing anyway`);
                console.log(`[${position.name}] Network error - server may be down or request timed out`);
              } else {
                setFaceStatus(`Error checking ${position.name} - continuing anyway`);
              }
              
              // If face check fails, still add the image (don't block user)
              capturedImagesList.push(frame);
              setFaceStatus(`✓ ${position.name} captured (face check failed)`);
              console.log(`[${position.name}] ✓ IMAGE CAPTURED (face check failed, continuing anyway)`);
              frameCaptured = true;
              
              // Show next position or "Processing..." if last position (display only, logic continues normally)
              if (i + 1 < positions.length) {
                setCurrentPosition(positions[i + 1].name);
              } else {
                setCurrentPosition('Processing...');
              }
            }
          } else {
            console.log(`[${position.name}] Frame capture failed - frame:`, frame ? `length ${frame.length}` : 'null');
            retryCount++;
            if (retryCount < maxRetries) {
              setFaceStatus(`Failed: ${position.name} - Retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              setFaceStatus(`Failed: ${position.name} - Skipping`);
              frameCaptured = true; // Mark as done to move on
            }
          }
        }
      }

      console.log(`Scan loop completed. Captured ${capturedImagesList.length} images.`);

      if (capturedImagesList.length > 0) {
        console.log('Processing images...');
        setFaceStatus('Processing scan...');
        await processImages(capturedImagesList);
      } else {
        console.error('ERROR: No images were captured after all attempts');
        Alert.alert('Error', `No images were captured. Please try again.`);
        setIsScanning(false);
      }
    } catch (error: any) {
      console.error('Scanning error:', error);
      console.error('Error stack:', error.stack);
      Alert.alert('Error', error.message || 'Scanning failed');
      setIsScanning(false);
    } finally {
      // Don't set isScanning to false here if we're still processing
      if (!isProcessing) {
        setIsScanning(false);
      }
      setScanProgress(0);
      setCurrentPosition('');
      setFaceStatus('Ready');
    }
  };

  const processImages = async (images: string[]) => {
    setIsProcessing(true);
    try {
      console.log('processImages: Sending', images.length, 'images to server...');
      console.log('First image length:', images[0]?.length);
      console.log('First image preview:', images[0]?.substring(0, 50));
      
      const response = await client.post('/scans', {
        images,
      });

      console.log('processImages: Server response:', response.data);

      if (response.data) {
        Alert.alert('Success', 'Scan completed!', [
          {
            text: 'OK',
            onPress: () => {
              setShowCamera(false);
              setIsScanning(false);
              fetchScans();
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('processImages error:', error);
      
      let errorMessage = 'Failed to process scan';
      if (error.response?.status === 413) {
        errorMessage = 'Images too large. Please try again with better lighting or restart the server.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
      setScanProgress(0);
      setCurrentPosition('');
      setFaceStatus('Ready');
    }
  };

  const handleStartScan = async () => {
    if (!permission) {
      return;
    }
    if (!permission.granted) {
      await requestPermission();
      return;
    }
    setShowCamera(true);
    setFaceStatus('Ready to capture - Press button when ready');
  };

  const handleCapture = async () => {
    // Start scanning immediately - no face check before
    await startScanning();
  };

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      const response = await client.get('/scans');
      setScans(response.data);
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScans();
  };

  const latestScan = scans[0];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Facial Biometrics</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>New Scan</Text>
          <Text style={styles.actionSubtitle}>
            Capture a new facial scan to track your biometrics
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStartScan}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Start Scan</Text>
            )}
          </TouchableOpacity>
        </View>

        {latestScan && (
          <View style={styles.scanCard}>
            <Text style={styles.scanTitle}>Latest Scan</Text>
            <Text style={styles.scanDate}>
              {format(new Date(latestScan.scan_date), 'MMM dd, yyyy HH:mm')}
            </Text>

            <View style={styles.metricsGrid}>
              <MetricCard
                label="Water Retention"
                value={latestScan.water_retention}
                unit="%"
                trend="down"
              />
              <MetricCard
                label="Puffiness Index"
                value={latestScan.inflammation_index}
                trend="down"
              />
              <MetricCard
                label="Lymph Congestion"
                value={latestScan.lymph_congestion_score}
                trend="down"
              />
              <MetricCard
                label="Definition Score"
                value={latestScan.definition_score}
                trend="up"
              />
              <MetricCard
                label="Facial Fat Layer"
                value={latestScan.facial_fat_layer}
                unit="%"
                trend="down"
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            // @ts-ignore - navigation type issue
            navigation.navigate('Trends');
          }}
        >
          <Text style={styles.secondaryButtonText}>View Trends</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => {
          if (!isScanning) {
            setShowCamera(false);
          }
        }}
      >
        <View style={styles.modalContainer}>
          {permission?.granted && (
            <>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
              />
              <View style={styles.overlay}>
                <View style={styles.statusContainer}>
                  <Text style={styles.instructionText}>
                    {currentPosition || 'Ready to scan'}
                  </Text>
                  {isScanning && (
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${scanProgress}%` }]}
                      />
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cameraControls}>
                {!isScanning && !isProcessing ? (
                  <>
                    <TouchableOpacity
                      style={styles.captureButton}
                      onPress={handleCapture}
                    >
                      <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setShowCamera(false)}
                    >
                      <Text style={styles.buttonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setIsScanning(false);
                      setShowCamera(false);
                    }}
                  >
                    <Text style={styles.buttonText}>Cancel Scan</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60, // Extra padding for notch/Dynamic Island
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    color: '#2196F3',
    fontSize: 16,
  },
  actionCard: {
    backgroundColor: '#2a2a2a',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  actionSubtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanCard: {
    backgroundColor: '#2a2a2a',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 10,
  },
  scanTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  scanDate: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: '#1a1a1a',
    width: '48%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  metricLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 5,
  },
  metricValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  metricStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  statusContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  statusText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
  },
  captureButtonDisabled: {
    borderColor: '#666',
    backgroundColor: '#333',
  },
  captureButtonInnerDisabled: {
    backgroundColor: '#666',
  },
  closeButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
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
