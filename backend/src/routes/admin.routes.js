import { Router } from 'express';
import { getFinancialReport, listUsers, updateRole } from '../controllers/admin.controller.js';
import { verifyToken, verifyAdmin, verifySuperAdminOnly } from '../middlewares/authSecurity.js';

const router = Router();
router.use(verifyToken, verifyAdmin);
router.get('/reportes/financieros', getFinancialReport);
router.get('/usuarios', verifySuperAdminOnly, listUsers);
router.put('/usuarios/:id/rol', verifySuperAdminOnly, updateRole);

export default router;
