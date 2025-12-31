import express from 'express';
import { verifyToken } from './auth.js';
import { checkFacePosition } from '../services/facePoseDetection.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Check if face is in correct position
router.post('/check', async (req, res) => {
  try {
    const { image, requiredPose } = req.body;

    console.log('Face check request:', {
      hasImage: !!image,
      imageLength: image?.length,
      requiredPose: requiredPose || 'center'
    });

    if (!image) {
      return res.status(400).json({ error: 'Image required' });
    }

    const result = await checkFacePosition(image, requiredPose || 'center');
    console.log('Face check result:', result);
    res.json(result);
  } catch (error) {
    console.error('Face check error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      ready: false,
      message: 'Error checking face position',
      confidence: 0,
      error: error.message 
    });
  }
});

export default router;

