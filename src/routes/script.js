import express from 'express';
import { uploadLogosToR2, getCompanyEmbeddingGroups } from '../services/scriptService.js';
const router = express.Router();

router.get('/upload_logos_r2', async (req, res) => {
    const result = await uploadLogosToR2();
    res.json({result});
});

router.get('/company_embedding_groups', async (req, res) => {
    const result = await getCompanyEmbeddingGroups();
    res.json(result);
});

export default router;
