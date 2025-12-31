import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import client from '../api/client';
import { Audio } from 'expo-av';

type Pose = 'center' | 'left' | 'right' | 'up' | 'down';

interface Position {
  name: string;
  pose: Pose;
  progress: number;
}

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceStatus, setFaceStatus] = useState<string>('Ready');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const checkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigation = useNavigation();

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
    if (!cameraRef.current) {
      console.error('captureFrame: cameraRef.current is null');
      return null;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });
      if (!photo || !photo.base64) {
        console.error('captureFrame: photo or base64 is null', photo);
        return null;
      }
      return photo.base64;
    } catch (error: any) {
      console.error('captureFrame error:', error);
      console.error('Error details:', error.message, error.stack);
      return null;
    }
  };

  const startScanning = async () => {
    if (isScanning || isProcessing) return;

    setIsScanning(true);
    const capturedImagesList: string[] = [];
    let shouldStop = false;

    try {
      // Wait a moment for camera to be ready
      if (!cameraRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      for (let i = 0; i < positions.length; i++) {
        if (shouldStop || !isScanning) break;

        const position = positions[i];
        setCurrentPosition(position.name);
        setScanProgress(position.progress);
        setFaceStatus(`Capturing ${position.name}...`);

        if (i > 0) {
          await playBeep();
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Wait a moment before capturing to ensure camera is ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Capture frame
        console.log(`[${position.name}] Capturing...`);
        const frame = await captureFrame();
        if (frame && frame.length > 100) {
          capturedImagesList.push(frame);
          setCapturedImages([...capturedImagesList]);
          setFaceStatus(`✓ ${position.name} captured`);
          console.log(`[${position.name}] ✓ IMAGE CAPTURED (${frame.length} bytes)`);
        } else {
          console.log(`[${position.name}] Frame capture failed - frame:`, frame ? `length ${frame.length}` : 'null');
          setFaceStatus(`Failed: ${position.name}`);
          // Continue anyway to try next position
        }
      }

      // Process all captured images
      if (capturedImagesList.length > 0 && !shouldStop) {
        await processImages(capturedImagesList);
      } else if (!shouldStop) {
        Alert.alert('Error', 'No images were captured');
        setIsScanning(false);
      } else {
        setIsScanning(false);
      }
    } catch (error: any) {
      console.error('Scanning error:', error);
      Alert.alert('Error', error.message || 'Scanning failed');
      setIsScanning(false);
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setCurrentPosition('');
      setFaceStatus('Ready');
    }
  };

  const processImages = async (images: string[]) => {
    setIsProcessing(true);
    try {
      const response = await client.post('/scans', {
        images,
      });

      if (response.data) {
        Alert.alert('Success', 'Scan completed!', [
          {
            text: 'OK',
            onPress: () => {
              setIsScanning(false);
              navigation.navigate('Dashboard' as never);
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to process scan');
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
      setScanProgress(0);
      setCurrentPosition('');
      setFaceStatus('Ready');
    }
  };


  useEffect(() => {
    return () => {
      if (checkingIntervalRef.current) {
        clearInterval(checkingIntervalRef.current);
      }
    };
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.cameraContainer}>
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
            <Text style={styles.statusText}>{faceStatus}</Text>
            {isScanning && (
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${scanProgress}%` }]}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        {!isScanning ? (
          <TouchableOpacity
            style={[styles.button, isProcessing && styles.buttonDisabled]}
            onPress={startScanning}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start Face ID Scan</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setIsScanning(false);
              setScanProgress(0);
              setCurrentPosition('');
              setFaceStatus('Ready');
            }}
          >
            <Text style={styles.buttonText}>Cancel Scan</Text>
          </TouchableOpacity>
        )}

        {capturedImages.length > 0 && (
          <View style={styles.capturedContainer}>
            <Text style={styles.capturedTitle}>
              Captured: {capturedImages.length} / {positions.length}
            </Text>
            <ScrollView horizontal style={styles.capturedImages}>
              {capturedImages.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: `data:image/jpeg;base64,${img}` }}
                  style={styles.capturedThumbnail}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  cameraContainer: {
    height: 400,
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
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
  readyIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    padding: 15,
    borderRadius: 10,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  readyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  notReadyIndicator: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    alignSelf: 'center',
  },
  notReadyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    padding: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  capturedContainer: {
    marginTop: 20,
  },
  capturedTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
  },
  capturedImages: {
    flexDirection: 'row',
  },
  capturedThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
  },
});
