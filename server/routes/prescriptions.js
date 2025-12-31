import express from 'express';
import { verifyToken } from './auth.js';
import { get, query } from '../db.js';
import { generatePrescriptions, generateWorkouts, generateInsights } from '../services/aiService.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get prescriptions for latest scan
router.get('/latest', async (req, res) => {
  try {
    const scan = await get(
      'SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 1',
      [req.userId]
    );

    if (!scan) {
      return res.status(404).json({ error: 'No scans found. Complete a scan first.' });
    }

    const metrics = {
      water_retention: scan.water_retention,
      inflammation_index: scan.inflammation_index,
      lymph_congestion_score: scan.lymph_congestion_score,
      facial_fat_layer: scan.facial_fat_layer,
      definition_score: scan.definition_score,
      potential_ceiling: scan.potential_ceiling,
    };

    const prescriptions = await generatePrescriptions(metrics);
    const workouts = await generateWorkouts(metrics);

    res.json({
      prescriptions,
      workouts: workouts.workouts || [],
      scan_date: scan.scan_date,
    });
  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ error: 'Failed to generate prescriptions' });
  }
});

// Get insights from trends
router.get('/insights', async (req, res) => {
  try {
    const scans = await query(
      'SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 5',
      [req.userId]
    );

    if (scans.length < 2) {
      return res.json({
        insights: 'Complete at least 2 scans to see trend insights.',
      });
    }

    const insights = await generateInsights(scans);
    res.json(insights);
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;

