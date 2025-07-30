const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createUser, getUserByEmail, getAdminEmails } = require('../models/userModel');
const JWT_SECRET = process.env.JWT_SECRET;
const { verifyToken } = require('../middleware/auth');
const { generateVerificationCode, sendVerificationEmail, sendAdminApprovalNotification } = require('../config/email');

// 인증 코드를 임시로 저장할 객체 (실제 운영에서는 Redis 등을 사용)
const verificationCodes = new Map();

// 회원가입
router.post('/register', async (req, res) => {
  const { email, password, name, company } = req.body;
  try {
    const existing = await getUserByEmail(email);
    if (existing) return res.status(400).json({ message: '이미 등록된 이메일입니다.' });

    // 이메일 인증 확인
    const storedData = verificationCodes.get(email);
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ message: '이메일 인증이 필요합니다.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await createUser(email, hashed, name, company);
    
    // 관리자에게 승인 알림 메일 발송
    try {
      const adminEmails = await getAdminEmails();
      if (adminEmails.length > 0) {
        await sendAdminApprovalNotification(adminEmails, newUser);
        console.log('관리자 승인 알림 메일 발송 완료');
      }
    } catch (error) {
      console.error('관리자 승인 알림 메일 발송 실패:', error);
      // 메일 발송 실패해도 회원가입은 성공으로 처리
    }
    
    // 인증 코드 삭제
    verificationCodes.delete(email);
    
    res.status(201).json({ message: '회원가입 완료 (관리자 승인 후 로그인 가능)' });
  } catch (err) {
    res.status(500).json({ error: '회원가입 오류' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for email: ${email}`);
  try {
    const user = await getUserByEmail(email);
    console.log('User found by email:', user ? user.email : 'None');

    if (!user) return res.status(400).json({ message: '사용자를 찾을 수 없습니다.' });

    if (!user.is_approved) return res.status(403).json({ message: '관리자 승인이 필요합니다.' });

    console.log('Comparing passwords:');
    console.log('  Input password (first 5 chars): ', password ? password.substring(0, 5) + '...' : '[empty]');
    console.log('  Stored password (first 5 chars): ', user.password ? user.password.substring(0, 5) + '...' : '[empty]');

    const valid = await bcrypt.compare(password, user.password);
    console.log('Password comparison result:', valid);

    if (!valid) return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables!');
      throw new Error('Server configuration error: JWT_SECRET is missing.');
    }

    console.log('Attempting to sign JWT token...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },  // role 추가!
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    console.log('JWT token signed successfully.');

    console.log('Sending successful login response.');
    res.json({ token });
  } catch (err) {
    console.error('로그인 처리 중 오류 발생:', err.message || err);
    res.status(500).json({ error: '로그인 오류' });
  }
});

// 이메일 인증 코드 발송
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;
  
  try {
    // 이미 등록된 이메일인지 확인
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: '이미 등록된 이메일입니다.' });
    }

    // 새로운 인증 코드 생성
    const verificationCode = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10분 후 만료

    // 인증 코드를 메모리에 저장
    verificationCodes.set(email, {
      code: verificationCode,
      expiresAt: expiresAt,
      verified: false
    });

    // 10분 후 자동 삭제
    setTimeout(() => {
      verificationCodes.delete(email);
    }, 10 * 60 * 1000);

    // 이메일 발송
    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      return res.status(500).json({ message: '이메일 발송에 실패했습니다.' });
    }

    res.json({ message: '인증 코드가 이메일로 발송되었습니다.' });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ message: '인증 코드 발송에 실패했습니다.' });
  }
});

// 이메일 인증 코드 확인
router.post('/verify-email', async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    // 인증 코드 확인
    const storedData = verificationCodes.get(email);
    console.log(storedData);
    
    if (!storedData) {
      return res.status(400).json({ message: '인증 코드가 만료되었습니다. 다시 발송해주세요.' });
    }

    if (storedData.verified) {
      return res.status(400).json({ message: '이미 인증된 이메일입니다.' });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ message: '인증 코드가 만료되었습니다. 다시 발송해주세요.' });
    }

    if (storedData.code !== verificationCode) {
      return res.status(400).json({ message: '유효하지 않은 인증 코드입니다.' });
    }

    // 인증 완료 처리
    storedData.verified = true;
    verificationCodes.set(email, storedData);

    res.json({ message: '이메일 인증이 완료되었습니다.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: '이메일 인증에 실패했습니다.' });
  }
});

// 로그인 사용자 정보
router.get('/me', verifyToken, async (req, res) => {
  const user = await getUserByEmail(req.user.email);
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

  const { password, ...safeUser } = user;
  res.json(safeUser);
});

module.exports = router;