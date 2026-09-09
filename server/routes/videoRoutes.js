import express from 'express';
import {
  ingestVideo,
  getVideos,
  getVideo,
  getVideoStatus,
  deleteVideo,
} from '../controllers/videoController.js';

const router = express.Router();

router.post('/ingest', ingestVideo);
router.get('/', getVideos);
router.get('/status/:videoId', getVideoStatus);
router.get('/:id', getVideo);
router.delete('/:id', deleteVideo);

export default router;
