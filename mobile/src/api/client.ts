import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Update this to your backend URL
// For local development, use your computer's IP address
// For production, use your deployed backend URL (e.g., Railway, Render, etc.)
// To find your local IP: ifconfig (Mac/Linux) or ipconfig (Windows)
// Using Render production URL since we're on different networks
// For local testing, change to your local IP: http://YOUR_IP:3001/api
const API_URL = 'https://looksmaxing-api.onrender.com/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout for large image uploads
  maxContentLength: Infinity, // Allow unlimited content length
  maxBodyLength: Infinity, // Allow unlimited body length
});

// Add token to requests
client.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error getting token:', error);
  }
  return config;
});

// Handle 401 errors - clear invalid token
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token is invalid, clear it
      try {
        await AsyncStorage.removeItem('token');
        console.log('Token cleared due to 401 error - please login again');
      } catch (e) {
        console.error('Error clearing token:', e);
      }
    }
    return Promise.reject(error);
  }
);

export default client;

