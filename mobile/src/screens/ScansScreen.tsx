import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Keyboard,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import client from '../api/client';
import { format } from 'date-fns';

const { width, height } = Dimensions.get('window');

// Search Icon Component - White magnifying glass from SVG
const SearchIcon = () => (
  <Svg width="24" height="24" viewBox="0 0 118.783 118.783" style={styles.searchIconContainer}>
    <Path
      d="M115.97,101.597L88.661,74.286c4.64-7.387,7.333-16.118,7.333-25.488c0-26.509-21.49-47.996-47.998-47.996
	S0,22.289,0,48.798c0,26.51,21.487,47.995,47.996,47.995c10.197,0,19.642-3.188,27.414-8.605l26.984,26.986
	c1.875,1.873,4.333,2.806,6.788,2.806c2.458,0,4.913-0.933,6.791-2.806C119.72,111.423,119.72,105.347,115.97,101.597z
	 M47.996,81.243c-17.917,0-32.443-14.525-32.443-32.443s14.526-32.444,32.443-32.444c17.918,0,32.443,14.526,32.443,32.444
	S65.914,81.243,47.996,81.243z"
      fill="#fff"
    />
  </Svg>
);

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
      <View style={metricsStyles.metricCard}>
        <Text style={metricsStyles.metricLabel}>{label}</Text>
        <Text style={metricsStyles.metricValue}>--{unit}</Text>
        <Text style={[metricsStyles.metricStatus, { color: '#999' }]}>N/A</Text>
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
    <View style={metricsStyles.metricCard}>
      <Text style={metricsStyles.metricLabel}>{label}</Text>
      <Text style={metricsStyles.metricValue}>
        {value.toFixed(1)}
        {unit}
      </Text>
      <Text style={[metricsStyles.metricStatus, { color: status.color }]}>
        {status.text}
      </Text>
    </View>
  );
}

export default function ScansScreen() {
  const navigation = useNavigation<any>();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [visibleScan, setVisibleScan] = useState<Scan | null>(null);

  // Save scans to local storage
  const saveScansLocally = async (scansToSave: Scan[]) => {
    try {
      await AsyncStorage.setItem('scans', JSON.stringify(scansToSave));
    } catch (error) {
      console.error('Failed to save scans locally:', error);
    }
  };

  // Load scans from local storage
  const loadScansLocally = async (): Promise<Scan[]> => {
    try {
      const stored = await AsyncStorage.getItem('scans');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load scans locally:', error);
    }
    return [];
  };

  const fetchScans = async () => {
    try {
      // First, load local scans to show immediately
      const localScans = await loadScansLocally();
      if (localScans.length > 0) {
        setScans(localScans);
        setLoading(false);
      }

      // Then try to fetch from server
      try {
        const response = await client.get('/scans');
        const serverScans = response.data || [];
        
        // Merge local and server scans, prioritizing server data
        // Combine and deduplicate by ID
        const allScans = [...serverScans];
        localScans.forEach((localScan: Scan) => {
          if (!serverScans.find((s: Scan) => s.id === localScan.id)) {
            allScans.push(localScan);
          }
        });
        
        // Sort by date (newest first)
        allScans.sort((a, b) => 
          new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
        );
        
        setScans(allScans);
        // Save merged scans locally
        await saveScansLocally(allScans);
      } catch (serverError) {
        // If server fails, use local scans (already set above)
        console.error('Failed to fetch scans from server:', serverError);
        if (localScans.length === 0) {
          // No local scans either, show error
          console.error('No scans available locally or from server');
        }
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error);
      // Try to load local scans as fallback
      const localScans = await loadScansLocally();
      if (localScans.length > 0) {
        setScans(localScans);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScans();
  };

  useEffect(() => {
    fetchScans();
  }, []);

  // Refresh when screen is focused (e.g., coming back from scan)
  useFocusEffect(
    React.useCallback(() => {
      fetchScans();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Set initial visible scan
  useEffect(() => {
    if (filteredScans.length > 0 && !visibleScan) {
      setVisibleScan(filteredScans[0]);
    }
  }, [filteredScans]);

  // Filter scans based on search query (date search)
  const filteredScans = scans.filter((scan) => {
    if (!searchQuery.trim()) return true;
    const scanDate = format(new Date(scan.scan_date), 'yyyy-MM-dd');
    const scanDateFormatted = format(new Date(scan.scan_date), 'MMM dd, yyyy');
    const query = searchQuery.toLowerCase();
    return (
      scanDate.includes(query) ||
      scanDateFormatted.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        {/* Transparent Header with Search Icon */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <SearchIcon />
          </TouchableOpacity>
        </View>

        {/* Search Bar - shown when showSearch is true */}
        <Modal
          visible={showSearch}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowSearch(false);
            setSearchQuery('');
            Keyboard.dismiss();
          }}
          supportedOrientations={['portrait']}
        >
          <View style={styles.searchModalOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.searchModalBackdrop}
              activeOpacity={1}
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
                Keyboard.dismiss();
              }}
            />
            <View style={styles.searchContainer} pointerEvents="box-none">
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by date (e.g., 2025-12-30 or Dec 30)"
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={styles.closeSearchButton}
                  onPress={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={styles.closeSearchButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      {filteredScans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No scans found' : 'No scans yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different date'
              : 'Start scanning to track your progress'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          pagingEnabled={false}
          showsVerticalScrollIndicator={true}
          onScroll={(event) => {
            const scrollY = event.nativeEvent.contentOffset.y;
            const itemHeight = height - 100;
            const viewportHeight = height - 100;
            // Switch when next image is halfway up the screen (at 50% of viewport)
            const threshold = scrollY + viewportHeight * 0.5;
            
            // Find which scan is at the threshold point
            const currentIndex = Math.floor(threshold / itemHeight);
            if (currentIndex >= 0 && currentIndex < filteredScans.length) {
              setVisibleScan(filteredScans[currentIndex]);
            }
          }}
          scrollEventThrottle={100}
          onScrollEndDrag={(event) => {
            const scrollY = event.nativeEvent.contentOffset.y;
            const itemHeight = height - 100;
            const viewportHeight = height - 100;
            const threshold = scrollY + viewportHeight * 0.5;
            
            const currentIndex = Math.floor(threshold / itemHeight);
            if (currentIndex >= 0 && currentIndex < filteredScans.length) {
              setVisibleScan(filteredScans[currentIndex]);
            }
          }}
          onMomentumScrollEnd={(event) => {
            const scrollY = event.nativeEvent.contentOffset.y;
            const itemHeight = height - 100;
            const viewportHeight = height - 100;
            const threshold = scrollY + viewportHeight * 0.5;
            
            const currentIndex = Math.floor(threshold / itemHeight);
            if (currentIndex >= 0 && currentIndex < filteredScans.length) {
              setVisibleScan(filteredScans[currentIndex]);
            }
          }}
        >
          {filteredScans.map((scan) => {
            const imageUri = scan.image_path
              ? `data:image/jpeg;base64,${scan.image_path}`
              : null;
            const dateTime = format(
              new Date(scan.scan_date),
              'MMM dd, yyyy HH:mm'
            );

            return (
              <TouchableOpacity
                key={scan.id}
                style={[
                  styles.fullScreenCard,
                  { height: height - 100 }, // Screen height minus tab bar (~100px)
                ]}
                onPress={() => {
                  const scanIndex = filteredScans.findIndex(s => s.id === scan.id);
                  navigation.navigate('ScanDetail', { 
                    scans: filteredScans, 
                    initialIndex: scanIndex >= 0 ? scanIndex : 0 
                  });
                }}
                activeOpacity={0.9}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.fullScreenImage, styles.mirroredImage]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fullScreenImage, styles.placeholderImage]}>
                    <Text style={styles.placeholderText}>No Image</Text>
                  </View>
                )}
                <View style={styles.dateContainer}>
                  <Text style={styles.dateText}>{dateTime}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      
      {/* Metrics Column on Right Side */}
      {visibleScan && (
        <View style={styles.metricsColumn}>
          <View style={styles.metricItem}>
            <Text style={styles.metricBarLabel}>Water</Text>
            <Text style={styles.metricBarValue}>{visibleScan.water_retention?.toFixed(1)}%</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricBarLabel}>Puff</Text>
            <Text style={styles.metricBarValue}>{visibleScan.inflammation_index?.toFixed(1)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricBarLabel}>Lymph</Text>
            <Text style={styles.metricBarValue}>{visibleScan.lymph_congestion_score?.toFixed(1)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricBarLabel}>Def</Text>
            <Text style={styles.metricBarValue}>{visibleScan.definition_score?.toFixed(1)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricBarLabel}>Fat</Text>
            <Text style={styles.metricBarValue}>{visibleScan.facial_fat_layer?.toFixed(1)}%</Text>
          </View>
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
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    paddingTop: 60,
    paddingRight: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  searchIconButton: {
    padding: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconContainer: {
    width: 24,
    height: 24,
  },
  searchModalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  searchModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    padding: 12,
    fontSize: 16,
  },
  closeSearchButton: {
    marginLeft: 10,
    padding: 8,
  },
  closeSearchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  fullScreenCard: {
    width: width,
    backgroundColor: '#000',
    marginBottom: 2,
    overflow: 'hidden',
  },
  fullScreenImage: {
    width: width,
    height: '100%',
  },
  mirroredImage: {
    transform: [{ scaleX: -1 }],
  },
  placeholderImage: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
  },
  dateContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
  },
  metricsColumn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -100, // Center vertically (approximate)
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  metricItem: {
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  metricBarLabel: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metricBarValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

const metricsStyles = StyleSheet.create({
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
