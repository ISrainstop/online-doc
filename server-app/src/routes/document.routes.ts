import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createDocument, getDocument, listDocuments, updateDocument, deleteDocument } from '../controllers/document.controller';

const router = Router();

router.use(authenticate);
router.get('/', listDocuments);
router.post('/', createDocument);
router.get('/:id', getDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router;
