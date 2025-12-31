import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';

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

  const imageUri = scan.image_path
    ? `data:image/jpeg;base64,${scan.image_path}`
    : null;
  const dateTime = format(new Date(scan.scan_date), 'MMM dd, yyyy HH:mm');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={() => {
            // Go back to the Progress screen (maintains scroll position)
            navigation.goBack();
          }}
          activeOpacity={0.9}
        >
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
        </TouchableOpacity>

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

