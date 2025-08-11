const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requireTeam } = require('../middleware/auth');
const { listNotices, getNoticeById, createNotice, updateNotice, deleteNotice } = require('../models/noticeModel');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const pool = require('../config/db');

// 목록 조회 (누구나) - 페이징 total 포함
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, keyword = '' } = req.query;
    const result = await listNotices({ limit: Number(limit), offset: Number(offset), keyword });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 목록 조회 실패' });
  }
});

// 상세 조회 (누구나)
router.get('/:id', async (req, res) => {
  try {
    const row = await getNoticeById(req.params.id);
    if (!row) return res.status(404).json({ message: '공지 없음' });
    const files = await pool.query(`SELECT id, url, originalname FROM notice_files WHERE notice_id = $1 ORDER BY id`, [req.params.id]);
    res.json({ ...row, files: files.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 조회 실패' });
  }
});

// 생성 (관리자/itsm_team)
router.post('/', verifyToken, requireTeam, upload.array('files', 5), async (req, res) => {
  try {
    const { title, content, is_pinned = false } = req.body;
    if (!title || !content) return res.status(400).json({ message: '제목/내용은 필수입니다.' });
    const row = await createNotice({ title, content, is_pinned, author_id: req.user.id });
    const files = req.files || [];
    for (const f of files) {
      const fixedOriginalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      await pool.query(`INSERT INTO notice_files (notice_id, url, originalname, public_id) VALUES ($1, $2, $3, $4)`, [row.id, f.path, fixedOriginalName, f.public_id || null]);
    }
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 생성 실패' });
  }
});

// 수정 (관리자/itsm_team)
router.put('/:id', verifyToken, requireTeam, async (req, res) => {
  try {
    const row = await updateNotice(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: '공지 없음' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 수정 실패' });
  }
});

// 삭제 (관리자/itsm_team)
router.delete('/:id', verifyToken, requireTeam, async (req, res) => {
  try {
    const row = await deleteNotice(req.params.id);
    if (!row) return res.status(404).json({ message: '공지 없음' });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '공지 삭제 실패' });
  }
});

module.exports = router;

