import React, { useState, useRef, useEffect } from 'react';
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
  image_path?: string | null;
  water_retention: number;
  inflammation_index: number;
  lymph_congestion_score: number;
  facial_fat_layer: number;
  definition_score: number;
}

type RootStackParamList = {
  ScanDetail: { scans: Scan[]; initialIndex: number };
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
  const { scans, initialIndex } = route.params;
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Scroll to initial index on mount
  useEffect(() => {
    if (scrollViewRef.current && initialIndex > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialIndex * screenWidth,
          animated: false,
        });
      }, 100);
    }
  }, [initialIndex]);

  const currentScan = scans[currentIndex];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    if (index !== currentIndex && index >= 0 && index < scans.length) {
      setCurrentIndex(index);
    }
  };

  const renderScanDetail = (scan: Scan, index: number) => {
    const imageUri = scan.image_path
      ? `data:image/jpeg;base64,${scan.image_path}`
      : null;
    const dateTime = format(new Date(scan.scan_date), 'MMM dd, yyyy HH:mm');

    return (
      <View key={scan.id} style={styles.scanPage}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.imageContainer}>
            {imageUri ? (
              <Image 
                source={{ uri: imageUri }} 
                style={[styles.detailImage, styles.mirroredImage]} 
                resizeMode="cover" 
              />
            ) : (
              <View style={[styles.detailImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
            <Text style={styles.dateText}>{dateTime}</Text>
          </View>

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
          Scan {currentIndex + 1} of {scans.length}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {scans.map((scan, index) => renderScanDetail(scan, index))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {scans.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
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
    flex: 1,
  },
  scanPage: {
    width: screenWidth,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    margin: 20,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  detailImage: {
    width: '100%',
    aspectRatio: 0.75,
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
});

