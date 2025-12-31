import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import client from '../api/client';
import { format } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

export default function TrendsScreen() {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      const response = await client.get('/scans/analytics/trends');
      setScans(response.data.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (scans.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No scan data available</Text>
      </View>
    );
  }

  const labels = scans.map((scan) =>
    format(new Date(scan.scan_date), 'MMM dd')
  );
  const waterRetention = scans.map((scan) => scan.water_retention);
  const definitionScore = scans.map((scan) => scan.definition_score);

  const chartData = {
    labels: labels.length > 7 ? labels.slice(-7) : labels, // Show last 7 or all
    datasets: [
      {
        data: waterRetention.length > 7 ? waterRetention.slice(-7) : waterRetention,
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const definitionChartData = {
    labels: labels.length > 7 ? labels.slice(-7) : labels,
    datasets: [
      {
        data: definitionScore.length > 7 ? definitionScore.slice(-7) : definitionScore,
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#2a2a2a',
    backgroundGradientFrom: '#2a2a2a',
    backgroundGradientTo: '#1a1a1a',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#2196F3',
    },
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Water Retention Trend</Text>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Definition Score Trend</Text>
        <LineChart
          data={definitionChartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>
    </ScrollView>
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
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  chartContainer: {
    margin: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 10,
  },
  chartTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});


