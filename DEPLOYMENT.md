# Deployment Guide

## Deploying to Railway

Railway is the easiest way to deploy your server. It auto-detects Node.js apps and handles most configuration automatically.

### Steps:

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push
   ```

2. **Create a Railway account** at https://railway.app

3. **Create a new project** and select "Deploy from GitHub repo"

4. **Select your repository** and Railway will auto-detect your server

5. **Set environment variables** in Railway dashboard:
   - `OPENAI_API_KEY` - Your OpenAI API key (required)
   - `JWT_SECRET` - A random secret string for JWT tokens (optional, but recommended for production)
   - `PORT` - Railway sets this automatically, but defaults to 3001

6. **Railway will give you a URL** like: `https://your-app-name.up.railway.app`

7. **Update the API URL in your mobile app**:
   - Edit `mobile/src/api/client.ts`
   - Replace `'https://your-backend-url.com/api'` with your Railway URL + `/api`
   - Example: `'https://your-app-name.up.railway.app/api'`

### Quick Local Testing (Alternative)

If you just need to test quickly on a different network, you can use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
# Then run:
ngrok http 3001
```

This gives you a public URL like `https://abc123.ngrok.io` - update your mobile app's API URL to `https://abc123.ngrok.io/api`

