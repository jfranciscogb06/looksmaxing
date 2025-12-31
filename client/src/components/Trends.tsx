import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import client from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import './Trends.css';

interface TrendData {
  scan_date: string;
  water_retention: number;
  inflammation_index: number;
  lymph_congestion_score: number;
  facial_fat_layer: number;
  definition_score: number;
  potential_ceiling: number;
}

export default function Trends() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const response = await client.get('/scans/analytics/trends');
      const formatted = response.data.map((item: TrendData) => ({
        ...item,
        date: format(new Date(item.scan_date), 'MMM dd'),
      }));
      setTrends(formatted);
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading trends...</div>;
  }

  if (trends.length === 0) {
    return (
      <div className="trends-container">
        <div className="trends-header">
          <button onClick={() => navigate('/dashboard')} className="btn-back">
            ← Back
          </button>
          <h1>Trends</h1>
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
        <div className="empty-state">
          <p>No data yet. Complete a few scans to see trends!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trends-container">
      <div className="trends-header">
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Back
        </button>
        <h1>Progress Trends</h1>
        <button onClick={logout} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h2>Water Retention</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="water_retention" 
                stroke="#ff4444" 
                strokeWidth={2}
                dot={{ fill: '#ff4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>Inflammation Index</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="inflammation_index" 
                stroke="#ff8844" 
                strokeWidth={2}
                dot={{ fill: '#ff8844' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>Definition Score</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="definition_score" 
                stroke="#00ff00" 
                strokeWidth={2}
                dot={{ fill: '#00ff00' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>Potential Ceiling</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="potential_ceiling" 
                stroke="#667eea" 
                strokeWidth={2}
                dot={{ fill: '#667eea' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

