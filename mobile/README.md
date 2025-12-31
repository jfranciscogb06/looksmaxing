# Looksmaxing Mobile App (Expo)

Facial Biometrics Optimization App for mobile devices using Expo.

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Update API URL:**
   - Open `src/api/client.ts`
   - Update `API_URL` to your backend server URL
   - For local development with physical device, use your computer's IP address:
     ```typescript
     const API_URL = 'http://YOUR_IP_ADDRESS:3001/api';
     ```
   - For Expo Go on same network, find your IP with:
     ```bash
     # Mac/Linux
     ifconfig | grep "inet "
     
     # Windows
     ipconfig
     ```

3. **Start the backend server:**
   ```bash
   cd ../server
   npm run dev
   ```

4. **Start Expo:**
   ```bash
   cd mobile
   npm start
   ```

5. **Run on device:**
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Make sure your phone and computer are on the same WiFi network

## Features

- ✅ Login/Register
- ✅ Face scanning with camera
- ✅ Image upload for testing
- ✅ Dashboard with metrics
- ✅ Trends visualization
- ✅ ChatGPT Vision API integration

## Notes

- The app uses Expo Camera for face capture
- Images are sent as base64 to the backend
- Backend processes images with ChatGPT Vision API
- Make sure backend CORS allows your device's IP

## Troubleshooting

- **Can't connect to backend:** Check that API_URL in `client.ts` matches your backend IP
- **Camera not working:** Make sure camera permissions are granted
- **Images not uploading:** Check backend is running and accessible from your device

