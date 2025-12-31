import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import scanRoutes from './routes/scans.js';
import prescriptionRoutes from './routes/prescriptions.js';
import faceCheckRoutes from './routes/faceCheck.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit to handle base64 images (6 images * ~100-150KB each)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/face-check', faceCheckRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server after DB is ready
initDatabase()
  .then(() => {
    console.log('Database initialization complete');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

