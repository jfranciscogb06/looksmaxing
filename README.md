# Looksmaxing App - Facial Biometrics Optimization

Facial biometric optimization system that scans the face, detects bloating/inflammation, and tracks progress over time.

## Setup

1. **Install dependencies:**
```bash
npm run install:all
```

2. **Set up environment variables:**
```bash
cd server
# Create .env file with:
# PORT=3001
# JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
# OPENAI_API_KEY=your-openai-api-key-here
```

**Important**: Create a `.env` file in the `server/` directory with your OpenAI API key for AI-powered prescriptions.

3. **Run development servers:**
```bash
# From root directory
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Features (Phase 1 - MVP)

- ✅ User authentication (register/login)
- ✅ Face scanning with camera access
- ✅ Facial landmark detection using TensorFlow.js
- ✅ Metrics calculation:
  - Water Retention %
  - Inflammation Index
  - Lymph Congestion Score
  - Facial Fat Layer %
  - Definition Score
  - Potential Ceiling
- ✅ Progress tracking and trends visualization
- ✅ Scan history dashboard
- ✅ AI-powered prescriptions (OpenAI integration)
  - Daily nutrition targets (potassium, sodium, water timing)
  - Face workout recommendations
  - Trend insights and analysis

## Usage

1. **Register/Login**: Create an account or login
2. **Start Scan**: Click "Start Scan" to access your camera
3. **Capture**: Position your face in frame and click "Capture Scan"
4. **View Results**: See your metrics on the dashboard
5. **Track Trends**: View progress over time in the Trends page

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite
- **Face Detection**: TensorFlow.js + MediaPipe Face Mesh
- **Charts**: Recharts
- **AI**: OpenAI GPT-4o-mini for prescriptions and insights

## Next Steps (Future Phases)

- Phase 2: Prescriptions & workout library
- Phase 3: Potential engine & renderer
- Phase 4: Event mode, payments, notifications

