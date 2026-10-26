import { Router } from 'express';
import { metricsHandler } from '../../shared/observability/metrics.js';

const router = Router();

router.get('/metrics', metricsHandler);

export default router;
