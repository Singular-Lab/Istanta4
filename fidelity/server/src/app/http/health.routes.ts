import { Router } from 'express';
import { healthHandler } from '../../shared/observability/health.js';

const router = Router();

router.get('/health', healthHandler);

export default router;
