const express = require('express');
const router = express.Router();
const { approveUserById, updateUserById } = require('../models/userModel');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const pool = require('../config/db');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// 사용자 정보 수정 (본인 또는 관리자만)
router.patch('/:id', verifyToken, async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;

  // 로그인한 사용자가 본인이거나 관리자인지 확인
  if (req.user.id.toString() !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ message: '권한이 없습니다.' });
  }

  try {
    const updatedUser = await updateUserById(userId, updates);
    if (!updatedUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    res.json({ message: '사용자 정보가 성공적으로 수정되었습니다.', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: '사용자 정보 수정 중 오류 발생' });
  }
});

// 사용자 승인 또는 승인 취소
router.patch('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const { approve } = req.body;  // true 또는 false

  try {
    const updatedUser = await approveUserById(userId, approve);
    if (!updatedUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    res.json({ message: `사용자 ${approve ? '승인됨' : '승인 취소됨'}`, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: '승인 처리 중 오류 발생' });
  }
});

// Cloudinary 이미지 업로드 - 티켓 등록 시
router.post('/upload/ticket', upload.single('file'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ticket_files'
    });

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);
    res.json({ public_id: result.public_id, url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: '이미지 업로드 실패' });
  }
});

// Cloudinary 이미지 업로드 - 댓글 등록 시
router.post('/upload/reply', upload.single('file'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ticket_reply_files'
    });

    // 임시 파일 삭제
    fs.unlinkSync(req.file.path);
    res.json({ public_id: result.public_id, url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: '이미지 업로드 실패' });
  }
});


// 모든 사용자 조회 (관리자만)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, company_name, is_approved, role FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '사용자 목록 조회 실패' });
  }
});


const bcrypt = require('bcrypt');

// 비밀번호 확인
router.post('/verify-password', verifyToken, async (req, res) => {
  const { password } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    res.json({ message: '비밀번호가 확인되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로필 수정
router.put('/profile', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { name, company_name, password } = req.body;

  try {
    let updatedUser;

    if (password) {
      // 비밀번호 변경 로직
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const result = await pool.query(
        'UPDATE users SET name = $1, company_name = $2, password = $3 WHERE id = $4 RETURNING id, email, name, company_name, role, is_approved',
        [name, company_name, hashedPassword, userId]
      );
      updatedUser = result.rows[0];

    } else {
      // 비밀번호 변경 없이 정보 수정
      const result = await pool.query(
        'UPDATE users SET name = $1, company_name = $2 WHERE id = $3 RETURNING id, email, name, company_name, role, is_approved',
        [name, company_name, userId]
      );
      updatedUser = result.rows[0];
    }

    if (!updatedUser) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({ message: '프로필이 성공적으로 업데이트되었습니다.', user: updatedUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '프로필 업데이트 중 오류가 발생했습니다.' });
  }
});

// 계정 탈퇴 (본인만)
router.delete('/me', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const deletedUser = await deleteUserById(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ message: '계정이 성공적으로 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '계정 탈퇴 중 오류 발생' });
  }
});

module.exports = router;

