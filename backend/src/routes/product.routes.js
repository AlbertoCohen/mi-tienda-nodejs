import { Router } from 'express';
import { getCatalog, getProductDetail, getMenuNavigation, getGeoConfig } from '../controllers/public.catalog.controller.js';

const router = Router();
router.get('/', getCatalog);
router.get('/menu', getMenuNavigation);
router.get('/geo', getGeoConfig);
router.get('/:id', getProductDetail);

export default router;
