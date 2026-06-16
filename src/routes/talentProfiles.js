import express from 'express';
import multer from 'multer';
import path from 'path';
import { talentProfilesDao } from '../dao/talentProfilesDao.js';
import { uploadBufferToR2 } from '../utils/helper.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'jobs', 'support', 'login', 'signup', 'dashboard',
  'settings', 'profile', 'search', 'about', 'contact', 'help',
  'terms', 'privacy', 'blog', 'null', 'undefined',
]);

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required';
  if (username.length < 3 || username.length > 30) return 'Username must be 3-30 characters';
  if (!USERNAME_REGEX.test(username)) return 'Username can only contain letters, numbers, and underscores';
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return 'This username is reserved';
  return null;
}

// ── Public routes (order matters: before /:username) ──

// GET /search
router.get('/search', async (req, res) => {
  try {
    const result = await talentProfilesDao.search(req.query);
    return res.json(result);
  } catch (err) {
    logger.error('talent profile search failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// GET /categories
router.get('/categories', async (req, res) => {
  try {
    const rows = await talentProfilesDao.getCategories();
    const categories = rows.map((r) => r.category);
    return res.json({ categories });
  } catch (err) {
    logger.error('talent profile categories failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// GET /me?user_id=
router.get('/me', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await talentProfilesDao.getByUserId(user_id);
    if (!profile) return res.json({ profile: null });

    const [experiences, education, certifications] = await Promise.all([
      talentProfilesDao.getExperiences(profile.id),
      talentProfilesDao.getEducation(profile.id),
      talentProfilesDao.getCertifications(profile.id),
    ]);

    return res.json({ profile: { ...profile, experiences, education, certifications } });
  } catch (err) {
    logger.error('talent profile get me failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// GET /check-username/:username?user_id=
router.get('/check-username/:username', async (req, res) => {
  const { username } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const validationError = validateUsername(username);
    if (validationError) return res.json({ available: false, reason: validationError });

    const taken = await talentProfilesDao.checkUsername(username, user_id);
    return res.json({ available: !taken });
  } catch (err) {
    logger.error('talent profile check username failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── Authenticated routes ──

// POST / - Create profile
router.post('/', async (req, res) => {
  const { user_id, username, ...rest } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    // Check if profile already exists
    const existing = await talentProfilesDao.getByUserId(user_id);
    if (existing) return res.status(409).json({ error: 'Profile already exists' });

    // Validate username
    if (username) {
      const validationError = validateUsername(username);
      if (validationError) return res.status(400).json({ error: validationError });

      const taken = await talentProfilesDao.checkUsername(username, user_id);
      if (taken) return res.status(409).json({ error: 'Username is already taken' });
    }

    const profile = await talentProfilesDao.create({
      userId: user_id,
      username: username ? username.toLowerCase() : undefined,
      ...rest,
    });

    return res.status(201).json({ success: true, profile });
  } catch (err) {
    logger.error('talent profile create failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// PATCH / - Update profile
router.patch('/', async (req, res) => {
  const { user_id, username, ...rest } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    if (username !== undefined) {
      const validationError = validateUsername(username);
      if (validationError) return res.status(400).json({ error: validationError });

      const taken = await talentProfilesDao.checkUsername(username, user_id);
      if (taken) return res.status(409).json({ error: 'Username is already taken' });

      rest.username = username.toLowerCase();
    }

    const profile = await talentProfilesDao.update(user_id, rest);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ success: true, profile });
  } catch (err) {
    logger.error('talent profile update failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /visibility
router.patch('/visibility', async (req, res) => {
  const { user_id, status } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!status) return res.status(400).json({ error: 'status required' });

  try {
    const profile = await talentProfilesDao.updateVisibility(user_id, status);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ success: true, profile });
  } catch (err) {
    logger.error('talent profile visibility update failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── File uploads ──

// POST /avatar
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only PNG, JPG, and WebP images are allowed' });
  }

  try {
    const ext = req.file.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : req.file.mimetype.split('/')[1];
    const key = `talent-profiles/avatars/${user_id}-${Date.now()}.${ext}`;
    const url = await uploadBufferToR2(req.file.buffer, key, req.file.mimetype);

    const profile = await talentProfilesDao.update(user_id, { avatarUrl: url });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ success: true, avatar_url: url });
  } catch (err) {
    logger.error('talent profile avatar upload failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /resume
const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/resume', resumeUpload.single('resume'), async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Only PDF, DOC, and DOCX files are allowed' });
  }

  try {
    const extMap = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    const ext = extMap[req.file.mimetype];
    const key = `talent-profiles/resumes/${user_id}-${Date.now()}.${ext}`;
    const url = await uploadBufferToR2(req.file.buffer, key, req.file.mimetype);

    const profile = await talentProfilesDao.update(user_id, {
      resumeUrl: url,
      resumeFilename: req.file.originalname,
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ success: true, resume_url: url, resume_filename: req.file.originalname });
  } catch (err) {
    logger.error('talent profile resume upload failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /resume?user_id=
router.delete('/resume', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await talentProfilesDao.update(user_id, {
      resumeUrl: null,
      resumeFilename: null,
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ success: true });
  } catch (err) {
    logger.error('talent profile resume delete failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── Nested CRUD: Experiences ──

async function getProfileForUser(userId) {
  const profile = await talentProfilesDao.getByUserId(userId);
  return profile;
}

router.post('/experiences', async (req, res) => {
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const experience = await talentProfilesDao.addExperience(profile.id, data);
    return res.status(201).json({ success: true, experience });
  } catch (err) {
    logger.error('talent experience create failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/experiences/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const experience = await talentProfilesDao.updateExperience(id, profile.id, data);
    if (!experience) return res.status(404).json({ error: 'Experience not found' });

    return res.json({ success: true, experience });
  } catch (err) {
    logger.error('talent experience update failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/experiences/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const deleted = await talentProfilesDao.deleteExperience(id, profile.id);
    if (!deleted) return res.status(404).json({ error: 'Experience not found' });

    return res.json({ success: true });
  } catch (err) {
    logger.error('talent experience delete failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── Nested CRUD: Education ──

router.post('/education', async (req, res) => {
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const education = await talentProfilesDao.addEducation(profile.id, data);
    return res.status(201).json({ success: true, education });
  } catch (err) {
    logger.error('talent education create failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/education/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const education = await talentProfilesDao.updateEducation(id, profile.id, data);
    if (!education) return res.status(404).json({ error: 'Education not found' });

    return res.json({ success: true, education });
  } catch (err) {
    logger.error('talent education update failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/education/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const deleted = await talentProfilesDao.deleteEducation(id, profile.id);
    if (!deleted) return res.status(404).json({ error: 'Education not found' });

    return res.json({ success: true });
  } catch (err) {
    logger.error('talent education delete failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── Nested CRUD: Certifications ──

router.post('/certifications', async (req, res) => {
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const certification = await talentProfilesDao.addCertification(profile.id, data);
    return res.status(201).json({ success: true, certification });
  } catch (err) {
    logger.error('talent certification create failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/certifications/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, ...data } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const certification = await talentProfilesDao.updateCertification(id, profile.id, data);
    if (!certification) return res.status(404).json({ error: 'Certification not found' });

    return res.json({ success: true, certification });
  } catch (err) {
    logger.error('talent certification update failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/certifications/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const profile = await getProfileForUser(user_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const deleted = await talentProfilesDao.deleteCertification(id, profile.id);
    if (!deleted) return res.status(404).json({ error: 'Certification not found' });

    return res.json({ success: true });
  } catch (err) {
    logger.error('talent certification delete failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ── Public profile by username (MUST be last due to /:username catch-all) ──

router.get('/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const profile = await talentProfilesDao.getByUsername(username);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    return res.json({ profile });
  } catch (err) {
    logger.error('talent profile get by username failed', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
