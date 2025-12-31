import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Update this to your backend URL
// For local development, use your computer's IP address
// For production, use your deployed backend URL
const API_URL = __DEV__ 
  ? 'http://192.168.1.39:3001/api' // Your computer's IP address
  : 'https://your-backend-url.com/api';

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

export default client;

