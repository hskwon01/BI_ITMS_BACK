const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { approveUserById, updateUserById, deleteUserById } = require('../models/userModel');
const { verifyToken, requireAdmin, requireTeam } = require('../middleware/auth');
const pool = require('../config/db');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const path = require('path');
const { sendApprovalEmail } = require('../config/email');

// 고객 목록만 조회 (관리자, 기술지원팀)
router.get('/customers', verifyToken, requireTeam, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, company_name, is_approved, role FROM users WHERE role = 'customer' ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '고객 목록 조회 실패' });
  }
});

// 팀 멤버(관리자, 기술지원팀) 목록 조회
router.get('/team', verifyToken, requireTeam, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, is_approved FROM users WHERE role IN ('admin', 'itsm_team') ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '팀 멤버 목록 조회 실패' });
  }
});

// 담당자 목록 조회 (기술지원팀 및 관리자)
router.get('/assignees', verifyToken, requireTeam, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email FROM users WHERE role IN ('itsm_team', 'admin') ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '담당자 목록 조회 실패' });
  }
});

// 새로운 팀 멤버 생성 (관리자만)
router.post('/team', verifyToken, requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!['admin', 'itsm_team'].includes(role)) {
    return res.status(400).json({ error: '잘못된 역할입니다.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO users (email, password, name, role, is_approved) VALUES ($1, $2, $3, $4, true) RETURNING id, email, name, role`,
      [email, hashedPassword, name, role]
    );

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: '이미 사용중인 이메일입니다.' });
    }
    res.status(500).json({ error: '팀 멤버 생성 실패' });
  }
});

// 사용자에게 회원가입 승인 이메일 전송
router.post('/:id/send-approval-email', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    const result = await pool.query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: '사용자 없음' });

    await sendApprovalEmail(user.email, user.name);
    res.json({ message: '이메일 전송 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '이메일 전송 실패' });
  }
});

// 사용자 정보 수정 (본인 또는 관리자만)
router.patch('/:id', verifyToken, async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;

  if (req.user.id.toString() !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ message: '권한이 없습니다.' });
  }

  try {
    const updatedUser = await updateUserById(userId, updates);
    if (!updatedUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    res.json({ message: '사용자 정보가 성공적으로 수정되었습니다.', user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '사용자 정보 수정 중 오류 발생' });
  }
});

// 사용자 승인 또는 승인 취소
router.patch('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const { approve } = req.body;

  try {
    const updatedUser = await approveUserById(userId, approve);
    if (!updatedUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    res.json({ message: `사용자 ${approve ? '승인됨' : '승인 취소됨'}`, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '승인 처리 중 오류 발생' });
  }
});

// Cloudinary 이미지 업로드 - 티켓 등록 시
router.post('/upload/ticket', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    // 업로드 옵션 설정
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const uploadOptions = {
      folder: 'ticket_files',
      resource_type: isImage ? 'image' : 'raw',
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    fs.unlinkSync(filePath); // 임시파일 삭제

    res.json({
      public_id: result.public_id,
      url: result.secure_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '파일 업로드 실패' });
  }
});

// Cloudinary 이미지 업로드 - 댓글 등록 시
router.post('/upload/reply', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    console.log("이미지 업로등ㅇㅇㅇㅇㅇㅇㅇㅇㅇㅇ");

    // 업로드 옵션 설정
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const uploadOptions = {
      folder: 'ticket_reply_files',
      resource_type: isImage ? 'image' : 'raw',
    };

    console.log("업로드 옵션!!!!!!!!!!", uploadOptions);

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    fs.unlinkSync(filePath); // 임시파일 삭제

    res.json({
      public_id: result.public_id,
      url: result.secure_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '파일 업로드 실패' });
  }
});

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
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const result = await pool.query(
        'UPDATE users SET name = $1, company_name = $2, password = $3 WHERE id = $4 RETURNING id, email, name, company_name, role, is_approved',
        [name, company_name, hashedPassword, userId]
      );
      updatedUser = result.rows[0];

    } else {
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