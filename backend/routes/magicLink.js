const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  createRequest,
  getRequestByEmail,
  getPendingRequests,
  getRequestsByStatus,
  getAllRequests,
  approveRequestById,
  rejectRequestById, // 추가
  setMagicToken,
  getRequestByValidToken,
  invalidateToken,
} = require('../models/magicLinkRequestModel');
const { sendMagicLinkEmail, sendAdminNewRequestNotification, sendAccessRequestRejectionEmail } = require('../config/email');
const { getAdminEmails, getUserByEmail, createMagicUser } = require('../models/userModel');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

// 이메일에서 클릭 시 기본 브라우저(크롬 등) 새 탭으로 열리도록 중간 오픈 엔드포인트
// 예: /api/magic-link/open?token=abc
router.get('/open', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('잘못된 요청입니다. 토큰이 없습니다.');
  }
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const targetUrl = `${baseUrl}/magic-login?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html>
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="refresh" content="0; url='${targetUrl}'" />
      <title>ITSM 로그인으로 이동 중...</title>
      <script>
        // 새 탭으로 열기 시도 (브라우저에 따라 무시될 수 있음)
        try { window.open('${targetUrl}', '_blank', 'noopener,noreferrer'); } catch (e) {}
      </script>
      <style>body{font-family:Arial, sans-serif; padding:40px;}</style>
    </head>
    <body>
      <p>잠시만 기다려 주세요. ITSM 로그인 페이지로 이동 중입니다...</p>
      <p><a href="${targetUrl}" target="_blank" rel="noopener noreferrer">바로 이동하기</a></p>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

// 1. 사용자가 접근 권한 요청
router.post('/request-access', async (req, res) => {
  const { email, name, company } = req.body;
  try {
    const existingRequest = await getRequestByEmail(email);
    if (existingRequest && (existingRequest.status === 'pending' || existingRequest.status === 'approved')) {
      return res.status(400).json({ message: '이미 접근 요청이 제출되었거나 승인된 이메일입니다.' });
    }

    const newRequest = await createRequest(email, name, company);

    // 관리자에게 알림 이메일 발송
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendAdminNewRequestNotification(adminEmails, newRequest);
    }

    res.status(201).json({ message: '접근 요청이 성공적으로 제출되었습니다. 관리자 승인 후 이메일을 확인해주세요.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 2. 관리자가 승인 대기 목록 조회
router.get('/admin/requests', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let requests;
    if (!status || status === 'all') {
      requests = await getAllRequests();
    } else if (['pending', 'approved', 'rejected', 'used'].includes(status)) {
      requests = await getRequestsByStatus(status);
    } else {
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 3. 관리자가 접근 요청 승인
router.post('/admin/requests/:id/approve', verifyToken, requireAdmin, async (req, res) => {
  // (실제 구현 시, 관리자 인증 미들웨어 필요)
  try {
    const approvedRequest = await approveRequestById(req.params.id);
    if (!approvedRequest) {
      return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    }

    // users 테이블에 해당 이메일의 사용자가 있는지 확인
    let user = await getUserByEmail(approvedRequest.email);

    // 사용자가 없으면 새로 생성
    if (!user) {
      user = await createMagicUser(approvedRequest.email, approvedRequest.name, approvedRequest.company_name);
    }

    // 매직 링크 토큰 생성 및 저장
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // 10년 후 만료
    await setMagicToken(approvedRequest.email, token, expiresAt);

    // 사용자에게 매직 링크 이메일 발송
    await sendMagicLinkEmail(approvedRequest.email, token);

    res.json({ message: '사용자 접근 요청이 승인되었고, 로그인 링크가 이메일로 발송되었습니다.' });
  } catch (err) {
    console.error('승인 및 이메일 발송 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 관리자가 접근 요청 거부
router.post('/admin/requests/:id/reject', verifyToken, requireAdmin, async (req, res) => {
  // (실제 구현 시, 관리자 인증 미들웨어 필요)
  try {
    const rejectedRequest = await rejectRequestById(req.params.id);
    if (!rejectedRequest) {
      return res.status(404).json({ message: '요청을 찾을 수 없습니다.' });
    }

    // 사용자에게 거절 알림 이메일 발송
    await sendAccessRequestRejectionEmail(rejectedRequest.email, rejectedRequest.name);

    res.json({ message: '사용자 접근 요청이 거부되었고, 거절 알림 이메일이 발송되었습니다.' });
  } catch (err) {
    console.error('거부 처리 및 이메일 발송 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 4. 사용자가 로그인 링크 발급 요청
router.post('/request-login-link', async (req, res) => {
  const { email } = req.body;
  try {
    const request = await getRequestByEmail(email);
    if (!request || request.status !== 'approved') {
      return res.status(404).json({ message: '승인된 사용자가 아니거나 잘못된 이메일입니다.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

    await setMagicToken(email, token, expiresAt);
    await sendMagicLinkEmail(email, token);

    res.json({ message: '로그인 링크가 이메일로 발송되었습니다. 10분 안에 확인해주세요.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 5. 매직 링크를 통한 로그인 처리
router.post('/login-with-link', async (req, res) => {
  const { token } = req.body;
  try {
    const request = await getRequestByValidToken(token);
    if (!request) {
      return res.status(400).json({ message: '유효하지 않거나 만료된 링크입니다.' });
    }

    // 이메일을 기반으로 users 테이블에서 실제 사용자 정보를 가져옴
    const user = await getUserByEmail(request.email);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 토큰 무효화 (테스트를 위해 주석 처리)
    // await invalidateToken(token);

    // JWT 발급 (users 테이블의 id와 role 사용)
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
