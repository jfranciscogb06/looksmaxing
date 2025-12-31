import express from 'express';
import { verifyToken } from './auth.js';
import { run, query, get } from '../db.js';
import { analyzeFacialStructure } from '../services/faceAnalysisService.js';

const router = express.Router();

// All scan routes require authentication
router.use(verifyToken);

// Create a new scan
router.post('/', async (req, res) => {
  try {
    const { images } = req.body;

    console.log('Received scan request:', {
      hasImages: !!images,
      isArray: Array.isArray(images),
      imagesLength: images?.length,
      firstImageLength: images?.[0]?.length,
      firstImagePreview: images?.[0]?.substring(0, 50)
    });

    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('Invalid images data:', { images });
      return res.status(400).json({ error: 'Images required (array of base64 images)' });
    }

    // Validate base64 format
    for (let i = 0; i < images.length; i++) {
      if (!images[i] || typeof images[i] !== 'string' || images[i].length < 100) {
        console.error(`Invalid image at index ${i}:`, {
          type: typeof images[i],
          length: images[i]?.length,
          preview: images[i]?.substring(0, 50)
        });
        return res.status(400).json({ error: `Invalid image format at index ${i}. Expected base64 string.` });
      }
    }

    console.log('Processing scan with', images.length, 'image(s)');
    
    try {
      // Use ChatGPT Vision to analyze images
      const metrics = await analyzeFacialStructure(images);
      
      if (!metrics || typeof metrics.water_retention !== 'number') {
        console.error('Invalid metrics returned:', metrics);
        return res.status(500).json({ error: 'Failed to calculate metrics' });
      }

      // Validate all required metrics are present and valid
      const requiredMetrics = ['water_retention', 'inflammation_index', 'lymph_congestion_score', 'facial_fat_layer', 'definition_score', 'potential_ceiling'];
      for (const metric of requiredMetrics) {
        if (typeof metrics[metric] !== 'number' || isNaN(metrics[metric])) {
          console.error(`Missing or invalid metric: ${metric}`, metrics[metric]);
          return res.status(500).json({ error: `Invalid metric: ${metric}` });
        }
      }

      // Store center image (first image) and images count
      const centerImage = images[0] || null; // Store first/center image
      const result = await run(
        `INSERT INTO scans (
          user_id, image_path, landmarks, water_retention, inflammation_index,
          lymph_congestion_score, facial_fat_layer, definition_score, potential_ceiling
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.userId,
          centerImage, // Store center image as base64 in image_path field
          JSON.stringify({ images: images.length }), // Store count of images
          metrics.water_retention,
          metrics.inflammation_index,
          metrics.lymph_congestion_score,
          metrics.facial_fat_layer,
          metrics.definition_score,
          metrics.potential_ceiling
        ]
      );

      const scan = await get('SELECT * FROM scans WHERE id = ?', [result.lastID]);
      
      if (!scan) {
        console.error('Failed to retrieve created scan');
        return res.status(500).json({ error: 'Failed to retrieve scan after creation' });
      }
      
      // Parse landmarks JSON
      if (scan.landmarks) {
        try {
          scan.landmarks = JSON.parse(scan.landmarks);
        } catch (parseError) {
          console.error('Error parsing landmarks JSON:', parseError);
          scan.landmarks = null;
        }
      }

      console.log('Scan created successfully:', {
        id: scan.id,
        water_retention: scan.water_retention,
        inflammation_index: scan.inflammation_index
      });

      res.json(scan);
    } catch (analysisError) {
      console.error('Analysis error:', analysisError);
      console.error('Error stack:', analysisError.stack);
      return res.status(500).json({ error: `Analysis failed: ${analysisError.message}` });
    }
  } catch (error) {
    console.error('Create scan error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Failed to create scan: ${error.message}` });
  }
});

// Get all scans for user
router.get('/', async (req, res) => {
  try {
    const scans = await query(
      'SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC',
      [req.userId]
    );

    // Parse landmarks JSON for each scan
    scans.forEach(scan => {
      if (scan.landmarks) {
        scan.landmarks = JSON.parse(scan.landmarks);
      }
    });

    res.json(scans);
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// Get single scan
router.get('/:id', async (req, res) => {
  try {
    const scan = await get(
      'SELECT * FROM scans WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    if (scan.landmarks) {
      scan.landmarks = JSON.parse(scan.landmarks);
    }

    res.json(scan);
  } catch (error) {
    console.error('Get scan error:', error);
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

// Get trends/analytics
router.get('/analytics/trends', async (req, res) => {
  try {
    const scans = await query(
      `SELECT 
        scan_date,
        water_retention,
        inflammation_index,
        lymph_congestion_score,
        facial_fat_layer,
        definition_score,
        potential_ceiling
      FROM scans 
      WHERE user_id = ? 
      ORDER BY scan_date ASC`,
      [req.userId]
    );

    res.json(scans);
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

export default router;

