import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import { format } from 'date-fns';
import './Dashboard.css';

interface Scan {
  id: number;
  scan_date: string;
  water_retention: number;
  inflammation_index: number;
  lymph_congestion_score: number;
  facial_fat_layer: number;
  definition_score: number;
  potential_ceiling: number;
}

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

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
    }
  };

  const latestScan = scans[0];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="user-email">{user?.email}</p>
        </div>
        <button onClick={logout} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="action-card">
          <h2>New Scan</h2>
          <p>Capture a new facial scan to track your biometrics</p>
          <button 
            onClick={() => navigate('/scan')}
            className="btn-primary-large"
          >
            Start Scan
          </button>
        </div>

        {latestScan && (
          <div className="latest-scan-card">
            <h2>Latest Scan</h2>
            <p className="scan-date">
              {format(new Date(latestScan.scan_date), 'MMM dd, yyyy HH:mm')}
            </p>
            
            <div className="metrics-grid">
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
                description="Soft-tissue fullness index (structural-only). Measures puffiness/fullness from geometric landmarks. Lower is better. Note: This is not true inflammation (which requires visual/texture analysis)."
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
            </div>
          </div>
        )}

        {scans.length > 0 && (
          <div className="scans-list-card">
            <div className="scans-list-header">
              <h2>Scan History</h2>
              <button 
                onClick={() => navigate('/trends')}
                className="btn-link"
              >
                View Trends →
              </button>
            </div>
            
            <div className="scans-list">
              {scans.slice(0, 5).map((scan) => (
                <div key={scan.id} className="scan-item">
                  <div className="scan-item-date">
                    {format(new Date(scan.scan_date), 'MMM dd, yyyy')}
                  </div>
                  <div className="scan-item-metrics">
                    <span>Def: {scan.definition_score}</span>
                    <span>Water: {scan.water_retention}%</span>
                    <span>Puff: {scan.inflammation_index}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && scans.length === 0 && (
          <div className="empty-state">
            <p>No scans yet. Start your first scan to begin tracking!</p>
          </div>
        )}
      </div>
    </div>
  );
}

const metricDescriptions: Record<string, string> = {
  'Water Retention': 'Estimated from facial geometry (structural proxy). Measures soft-tissue fullness patterns. Lower is better. Best used for tracking relative changes over time.',
  'Puffiness Index': 'Soft-tissue fullness index (structural-only). Measures reactive puffiness/fullness from geometric landmarks. Lower is better. Note: This is not true inflammation (which requires visual/texture analysis).',
  'Lymph Congestion': 'Estimated from facial geometry (structural proxy). Measures lower-face drainage patterns from jaw definition and soft-tissue distribution. Lower is better.',
  'Facial Fat Layer': 'Estimated from facial geometry (structural proxy). Measures stable fullness patterns (cheek prominence, face shape). Lower is better.',
  'Definition Score': 'How close to perfect face definition (100 = perfect). Based on jaw sharpness, structure, and lack of puffiness compared to ideal. Higher is better.',
  'Potential Ceiling': 'Maximum achievable score (100% = perfect face potential). Your definition score plus symmetry and structure bonuses - shows max potential after optimization.'
};

function MetricCard({ 
  label, 
  value, 
  unit = '', 
  trend 
}: { 
  label: string; 
  value: number; 
  unit?: string;
  trend: 'up' | 'down';
}) {
  const trendColor = trend === 'up' ? '#00ff00' : '#ff4444';
  const description = metricDescriptions[label] || '';
  
  // Determine status based on value and trend
  let statusText = '';
  let statusColor = '#888';
  
  if (trend === 'down') {
    // Lower is better metrics
    if (value < 30) {
      statusText = 'Excellent';
      statusColor = '#00ff00';
    } else if (value < 50) {
      statusText = 'Good';
      statusColor = '#88ff00';
    } else if (value < 70) {
      statusText = 'Moderate';
      statusColor = '#ffaa00';
    } else {
      statusText = 'High';
      statusColor = '#ff4444';
    }
  } else {
    // Higher is better metrics
    if (value > 70) {
      statusText = 'Excellent';
      statusColor = '#00ff00';
    } else if (value > 50) {
      statusText = 'Good';
      statusColor = '#88ff00';
    } else if (value > 30) {
      statusText = 'Moderate';
      statusColor = '#ffaa00';
    } else {
      statusText = 'Low';
      statusColor = '#ff4444';
    }
  }
  
  return (
    <div className="metric-card" title={description}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: trendColor }}>
        {value.toFixed(1)}{unit}
      </div>
      <div className="metric-status" style={{ color: statusColor }}>
        {statusText}
      </div>
      {description && (
        <div className="metric-description">{description}</div>
      )}
    </div>
  );
}

