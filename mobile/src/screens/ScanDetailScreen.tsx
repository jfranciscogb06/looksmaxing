import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');

interface Scan {
  id: number;
  scan_date: string;
  image_path?: string | string[] | null; // Can be single image (string) or array of images
  water_retention: number;
  inflammation_index: number;
  lymph_congestion_score: number;
  facial_fat_layer: number;
  definition_score: number;
}

type RootStackParamList = {
  ScanDetail: { scan: Scan };
};

type ScanDetailRouteProp = RouteProp<RootStackParamList, 'ScanDetail'>;

// MetricCard component
function MetricCard({
  label,
  value,
  unit = '',
  trend,
}: {
  label: string;
  value: number | null;
  unit?: string;
  trend: 'up' | 'down';
}) {
  if (value === null || value === undefined) {
    return (
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>--{unit}</Text>
        <Text style={[styles.metricStatus, { color: '#999' }]}>N/A</Text>
      </View>
    );
  }

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

export default function ScanDetailScreen() {
  const route = useRoute<ScanDetailRouteProp>();
  const navigation = useNavigation();
  const { scan } = route.params;
  
  // Get images array - handle both old format (single string) and new format (array)
  const images = useMemo(() => {
    if (!scan.image_path) return [];
    if (Array.isArray(scan.image_path)) {
      return scan.image_path;
    }
    // Old format: single image string, convert to array
    return [scan.image_path];
  }, [scan.image_path]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  };

  const renderImage = (imageBase64: string, index: number) => {
    const imageUri = `data:image/jpeg;base64,${imageBase64}`;
    const positionNames = ['Center', 'Look Left', 'Look Right', 'Look Up', 'Look Down', 'Center Again'];
    const positionName = positionNames[index] || `Angle ${index + 1}`;

    return (
      <View key={`image-${index}`} style={styles.imagePage}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={[styles.detailImage, styles.mirroredImage]} 
            resizeMode="cover" 
          />
          <Text style={styles.dateText}>{format(new Date(scan.scan_date), 'MMM dd, yyyy HH:mm')} - {positionName}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {images.length > 1 ? `Angle ${currentIndex + 1} of ${images.length}` : 'Scan Details'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        {images.length > 1 ? (
          <>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              style={styles.carousel}
            >
              {images.map((imageBase64, index) => renderImage(imageBase64, index))}
            </ScrollView>

            {/* Pagination dots */}
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </>
        ) : images.length === 1 ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: `data:image/jpeg;base64,${images[0]}` }} 
              style={[styles.detailImage, styles.mirroredImage]} 
              resizeMode="cover" 
            />
            <Text style={styles.dateText}>{format(new Date(scan.scan_date), 'MMM dd, yyyy HH:mm')}</Text>
          </View>
        ) : null}

        {/* Metrics section - scrollable with everything else */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Metrics</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Water Retention"
              value={scan.water_retention}
              unit="%"
              trend="down"
            />
            <MetricCard
              label="Puffiness Index"
              value={scan.inflammation_index}
              trend="down"
            />
            <MetricCard
              label="Lymph Congestion"
              value={scan.lymph_congestion_score}
              trend="down"
            />
            <MetricCard
              label="Definition Score"
              value={scan.definition_score}
              trend="up"
            />
            <MetricCard
              label="Facial Fat Layer"
              value={scan.facial_fat_layer}
              unit="%"
              trend="down"
            />
          </View>
        </View>
      </ScrollView>

      {images.length === 0 && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No images available</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  carousel: {
    height: Dimensions.get('window').height * 0.7, // Use 70% of screen height for carousel
  },
  scanPage: {
    width: screenWidth,
    height: Dimensions.get('window').height * 0.7,
  },
  imagePage: {
    width: screenWidth,
    height: Dimensions.get('window').height * 0.7,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    margin: 10,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  mirroredImage: {
    transform: [{ scaleX: -1 }],
  },
  placeholderImage: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  },
  dateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  metricsSection: {
    padding: 20,
    paddingTop: 10,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    paddingBottom: 30,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#2196F3',
    width: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: '#2a2a2a',
    width: '48%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});

