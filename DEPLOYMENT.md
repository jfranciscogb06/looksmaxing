# Deployment Guide - Render

## Deploying to Render

Render is a simple platform for deploying Node.js apps. Follow these steps:

### Step 1: Push Code to GitHub ✅

Your code is already pushed to GitHub at `jfranciscogb06/looksmaxing`.

### Step 2: Create Web Service on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** button (top right)
3. Select **"Web Service"**
4. Connect your GitHub account if not already connected
5. **Select your repository**: `jfranciscogb06/looksmaxing`
6. Click **"Connect"**

### Step 3: Configure the Service

Fill in these settings:

- **Name**: `looksmaxing-api` (or whatever you want)
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: Leave empty (we'll set commands manually)
- **Runtime**: `Node`
- **Build Command**: `cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Plan**: Choose **Free** (or paid if you want)

### Step 4: Set Environment Variables

Click on **"Advanced"** and add these environment variables:

- **Key**: `OPENAI_API_KEY`
  - **Value**: Your OpenAI API key (paste it here)
  
- **Key**: `JWT_SECRET`
  - **Value**: Generate a random string (you can use: `openssl rand -hex 32` or any random string)

- **Key**: `NODE_ENV`
  - **Value**: `production`

Render will automatically set `PORT` - your server code already handles this with `process.env.PORT || 3001`.

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying your app
3. Wait for the build to complete (usually 2-5 minutes)
4. Once deployed, you'll see a URL like: `https://looksmaxing-api.onrender.com`

### Step 6: Update Mobile App API URL

1. Open `mobile/src/api/client.ts`
2. Find this line:
   ```typescript
   : 'https://your-backend-url.com/api';
   ```
3. Replace it with your Render URL + `/api`:
   ```typescript
   : 'https://looksmaxing-api.onrender.com/api';
   ```
4. Save the file

### Step 7: Test It!

1. Make sure your Render service is running (check the dashboard)
2. Test the API: Visit `https://your-app.onrender.com/api/health` in a browser - should return `{"status":"ok"}`
3. Run your mobile app and try to fetch scans - it should now connect!

---

## Quick Local Testing (Alternative - ngrok)

If you just need to test quickly on a different network without deploying:

```bash
# Install ngrok: https://ngrok.com/download
# Then run:
ngrok http 3001
```

This gives you a public URL like `https://abc123.ngrok.io` - update your mobile app's API URL to `https://abc123.ngrok.io/api`

**Note**: The free ngrok URL changes every time you restart it, so it's only good for quick testing.
