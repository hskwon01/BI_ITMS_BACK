const express = require('express');
const router = express.Router();
const pool = require('../config/db');
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
const fs = require('fs');

const { createTicket, assignTicket } = require('../models/ticketModel');
const { verifyToken, requireAdmin, requireTeam } = require('../middleware/auth');
const { getRepliesByTicketId, addReply } = require('../models/replyModel');
const cloudinary = require('../config/cloudinary');
const { sendTicketNotificationToAdmin, sendTicketStatusUpdateToCustomer, sendTicketClosedNotification } = require('../config/email');

// 담당자 배정/수정
router.put('/:id/assignee', verifyToken, requireTeam, async (req, res) => {
  const ticketId = req.params.id;
  const { assignee_id } = req.body; // assignee_id는 null이 될 수도 있음 (배정 해제)

  try {
    const updatedTicket = await assignTicket(ticketId, assignee_id);
    if (!updatedTicket) {
      return res.status(404).json({ message: '티켓을 찾을 수 없습니다.' });
    }
    res.json({ message: '담당자 배정/수정 완료', ticket: updatedTicket });
  } catch (err) {
    console.error('담당자 배정/수정 오류:', err);
    res.status(500).json({ error: '담당자 배정/수정 실패' });
  }
});

// 티켓 첨부파일 삭제
router.delete('/files/ticket/:ticket_files_id', verifyToken, requireTeam, async (req, res) => {
  const { ticket_files_id } = req.params;

  try {
    // 1. 파일 정보 조회 (public_id 포함)
    const fileResult = await pool.query(
      `SELECT public_id FROM ticket_files WHERE id = $1`,
      [ticket_files_id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const file = fileResult.rows[0];

    // 2. Cloudinary에서 삭제
    if (file.public_id) {
      try {
        await cloudinary.uploader.destroy(file.public_id);
      } catch (cloudinaryErr) {
        console.error('Cloudinary 삭제 실패:', cloudinaryErr);
        // Cloudinary 삭제 실패해도 DB는 삭제 진행
      }
    }

    // 3. DB에서 삭제
    await pool.query(`DELETE FROM ticket_files WHERE id = $1`, [ticket_files_id]);

    res.json({ message: '파일 삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '파일 삭제 실패' });
  }
});

// 댓글 첨부파일 삭제
router.delete('/files/reply/:ticket_reply_files_id', verifyToken, async (req, res) => {
  const { ticket_reply_files_id } = req.params;
  const userId = req.user.id;

  try {
    // 1. 파일 정보 조회 (public_id 포함) 및 댓글 작성자 확인
    const fileCheck = await pool.query(`
      SELECT trf.public_id, r.author_id, r.id as reply_id 
      FROM ticket_reply_files trf
      JOIN ticket_replies r ON trf.reply_id = r.id
      WHERE trf.id = $1
    `, [ticket_reply_files_id]);

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    const file = fileCheck.rows[0];
    
    // 2. 권한 확인 (댓글 작성자 또는 관리자만 삭제 가능)
    if (file.author_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    // 3. Cloudinary에서 삭제
    if (file.public_id) {
      try {
        await cloudinary.uploader.destroy(file.public_id);
      } catch (cloudinaryErr) {
        console.error('Cloudinary 삭제 실패:', cloudinaryErr);
        // Cloudinary 삭제 실패해도 DB는 삭제 진행
      }
    }

    // 4. DB에서 삭제
    await pool.query(`DELETE FROM ticket_reply_files WHERE id = $1`, [ticket_reply_files_id]);

    res.json({ message: '댓글 파일 삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 파일 삭제 실패' });
  }
});

// 내 티켓별 미확인 관리자 댓글 수
router.get('/my/unread-counts', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 각 티켓에 대해 마지막 확인 시간과 관리자 댓글 비교
    const result = await pool.query(`
      SELECT
        t.id AS ticket_id,
        COUNT(r.*) FILTER (
          WHERE u.role = 'admin'
          AND (tr.last_read_at IS NULL OR r.created_at > tr.last_read_at)
        ) AS unread_count
      FROM tickets t
      LEFT JOIN ticket_replies r ON t.id = r.ticket_id
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN ticket_reads tr ON t.id = tr.ticket_id AND tr.user_id = $1
      WHERE t.customer_id = $1
      GROUP BY t.id
    `, [userId]);

    res.json(result.rows); // [{ ticket_id: 1, unread_count: 2 }, ...]
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '미확인 댓글 수 조회 실패' });
  }
});

// 고객 댓글 알림 확인
router.get('/admin/unread-counts', verifyToken, requireTeam, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id AS ticket_id,
        COUNT(r.*) FILTER (
          WHERE u.role = 'customer'
          AND (tr.last_read_at IS NULL OR r.created_at > tr.last_read_at)
        ) AS unread_count
      FROM tickets t
      LEFT JOIN ticket_replies r ON t.id = r.ticket_id
      LEFT JOIN users u ON r.author_id = u.id
      LEFT JOIN ticket_reads tr ON t.id = tr.ticket_id AND tr.user_id = $1
      GROUP BY t.id
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '관리자 미확인 댓글 수 조회 실패' });
  }
});

// 관리자 댓글 읽음 처리
router.post('/:id/read', verifyToken, async (req, res) => {
  const ticketId = req.params.id;
  const userId = req.user.id;

  try {
    await pool.query(`
      INSERT INTO ticket_reads (ticket_id, user_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (ticket_id, user_id)
      DO UPDATE SET last_read_at = NOW()
    `, [ticketId, userId]);

    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '읽음 처리 실패' });
  }
});

// 내 티켓 목록 (고객)
router.get('/my', verifyToken, async (req, res) => {
  const customer_id = req.user.id;
  const { status, urgency, keyword } = req.query;

  let query = `
    SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
    FROM tickets t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.customer_id = $1`;
  const params = [customer_id];
  let index = 2;

  if (status) {
    query += ` AND t.status = ${index++}`;
    params.push(status);
  }
  if (urgency) {
    query += ` AND t.urgency = ${index++}`;
    params.push(urgency);
  }
  if (keyword) {
    query += ` AND t.title ILIKE ${index++}`;
    params.push(`%${keyword}%`);
  }

  query += ` ORDER BY t.created_at DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '티켓 목록 조회 실패' });
  }
});

// 모든 티켓 목록 (관리자)
router.get('/', verifyToken, requireTeam, async (req, res) => {
  const { status, urgency, keyword } = req.query;

  let query = `
    SELECT t.*, u.email AS customer_email, u.company_name, u.name AS customer_name,
           a.name AS assignee_name, a.email AS assignee_email
    FROM tickets t
    LEFT JOIN users u ON t.customer_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE 1=1`;
  const params = [];
  let index = 1;

  if (status) {
    query += ` AND t.status = ${index++}`;
    params.push(status);
  }
  if (urgency) {
    query += ` AND t.urgency = ${index++}`;
    params.push(urgency);
  }
  if (keyword) {
    query += ` AND (t.title ILIKE ${index++} OR u.name ILIKE ${index++} OR a.name ILIKE ${index++})`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  query += ` ORDER BY t.created_at DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('전체 티켓 조회 실패:', err);
    res.status(500).json({ error: '전체 티켓 조회 실패' });
  }
});

// 티켓 상세 정보 + 댓글 + 첨부파일
router.get('/:id', verifyToken, async (req, res) => {
  const ticketId = req.params.id;

  try {
    // 1. 티켓 정보 (담당자 정보 포함)
    const ticketRes = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
       FROM tickets t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketRes.rows.length === 0) return res.status(404).json({ message: '티켓 없음' });
    const ticket = ticketRes.rows[0];

    // 2. 티켓 첨부파일 정보 추가
    const fileRes = await pool.query(
      `SELECT id as ticket_files_id, url, originalname, public_id FROM ticket_files WHERE ticket_id = $1`,
      [ticketId]
    );
    ticket.files = fileRes.rows;

    // 3. 댓글 + 첨부파일
    const replies = await getRepliesByTicketId(ticketId);

    res.json({ ticket, replies });
  } catch (err) {
    res.status(500).json({ error: '티켓 상세 조회 실패' });
  }
});

// 댓글 추가
router.post('/:id/replies', verifyToken, upload.array('files', 5), async (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;
  const author_id = req.user.id;
  
  if (!message && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ message: '내용 또는 파일 중 하나는 필요합니다.' });
  }

  try {
    const replyRes = await pool.query(
      `INSERT INTO ticket_replies (ticket_id, author_id, message)
       VALUES ($1, $2, $3) RETURNING id`,
      [ticketId, author_id, message]
    );
    const replyId = replyRes.rows[0].id;

    // 파일 저장
    const files = req.files || [];
    for (const file of files) {
      const fixedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); //PostgreSql 한글 깨짐 처리
      await pool.query(
        `INSERT INTO ticket_reply_files (reply_id, url, originalname, public_id)
         VALUES ($1, $2, $3, $4)`,
        [replyId, file.path, fixedOriginalName, file.public_id]
      );
    }

    res.status(201).json({ message: '댓글 등록 완료', reply_id: replyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 등록 실패' });
  }
});

// 댓글 수정
router.put('/:ticketId/replies/:replyId', verifyToken, async (req, res) => {
  const { message } = req.body;
  const { ticketId, replyId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM ticket_replies WHERE id = $1 AND ticket_id = $2 AND author_id = $3`,
      [replyId, ticketId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    await pool.query(
      `UPDATE ticket_replies SET message = $1, updated_at = NOW() WHERE id = $2`,
      [message, replyId]
    );

    res.json({ message: '댓글 수정 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 수정 실패' });
  }
});

// 댓글 삭제
router.delete('/:ticketId/replies/:replyId', verifyToken, async (req, res) => {
  const { ticketId, replyId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM ticket_replies WHERE id = $1 AND ticket_id = $2 AND author_id = $3`,
      [replyId, ticketId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await pool.query(`DELETE FROM ticket_replies WHERE id = $1`, [replyId]);

    res.json({ message: '댓글 삭제 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '댓글 삭제 실패' });
  }
});

// 티켓 생성
router.post('/', verifyToken, upload.array('files', 5), async (req, res) => {
  const { title, description, urgency, product, platform, sw_version, os } = req.body;
  const customer_id = req.user.id;
  // customer_name 조회  
  const result = await pool.query(`SELECT name FROM users WHERE id = $1`, [customer_id]);
  const customer_name = result.rows[0]?.name

  try {
    const newTicket = await createTicket({
      title,
      description,
      urgency,
      product,
      customer_id,
      platform,
      sw_version,
      os,
      status: '접수' // 초기 상태를 '접수'로 설정
    });
    const ticketId = newTicket.id;

    // 파일 정보 저장
    const files = req.files || [];
    for (const file of files) {
      const fixedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); //PostgreSql 한글 깨짐 처리
      await pool.query(
        `INSERT INTO ticket_files (ticket_id, url, originalname, public_id)
         VALUES ($1, $2, $3, $4)`,
        [ticketId, file.path, fixedOriginalName, file.public_id]
      );
    }

    // 관리자에게 알림 메일 발송
    try {
      const ticketData = {
        customer_name: customer_name,
        ticketId: ticketId,
        title: title,
        description: description,
        urgency: urgency,
        product: product,
        platform: platform,
        sw_version: sw_version,
        os: os,
        createdAt: new Date(newTicket.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
        // files는 이메일 본문에 포함되지 않으므로 제외
      };
      
      await sendTicketNotificationToAdmin(ticketData);
      console.log('관리자 티켓 알림 메일 발송 완료');
    } catch (emailError) {
      console.error('관리자 티켓 알림 메일 발송 실패:', emailError);
      // 메일 발송 실패해도 티켓 생성은 성공으로 처리
    }

    res.status(201).json({ message: '티켓 생성 완료', ticket_id: ticketId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '티켓 생성 실패' });
  }
});

// 관리자: 티켓 상태 변경
router.patch('/:id/status', verifyToken, requireTeam, async (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;

  const allowed = ['접수', '진행중', '답변 완료', '종결'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
  }

  try {
    const result = await pool.query(
      'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING customer_id, title, status, urgency, id as ticketId',
      [status, ticketId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '티켓을 찾을 수 없습니다.' });
    }

    const updatedTicket = result.rows[0];

    // 상태가 '진행중'으로 변경되었을 때 고객에게 알림 메일 발송
    if (status === '진행중') {
      try {
        const customerRes = await pool.query(
          `SELECT email FROM users WHERE id = $1`,
          [updatedTicket.customer_id]
        );
        const customerEmail = customerRes.rows[0]?.email;
        
        if (customerEmail) {
          const emailTicketData = {
            ...updatedTicket,
            ticketId: updatedTicket.ticketid
          };
          await sendTicketStatusUpdateToCustomer(emailTicketData, customerEmail);
          console.log('고객에게 티켓 상태 변경 알림 메일 발송 완료');
        }
      } catch (emailError) {
        console.error('고객 티켓 상태 변경 알림 메일 발송 실패:', emailError);
      }
    }
    
    // 상태가 '종결'로 변경되었을 때 고객, 담당자, 관리자에게 알림 메일 발송
    if (status === '종결') {
      try {
        // 1. 티켓의 상세 정보 조회 (고객명, 담당자명, 담당자 이메일 등)
        const ticketDetailsRes = await pool.query(
          `SELECT
             t.id, t.title, t.status, t.urgency,
             c.name as customer_name, c.email as customer_email,
             a.name as assignee_name, a.email as assignee_email
           FROM tickets t
           LEFT JOIN users c ON t.customer_id = c.id
           LEFT JOIN users a ON t.assignee_id = a.id
           WHERE t.id = $1`,
          [ticketId]
        );
        const ticketDetails = ticketDetailsRes.rows[0];

        // 2. 모든 관리자 및 기술지원팀 이메일 조회
        const adminUsersRes = await pool.query(
          `SELECT email FROM users WHERE role = 'admin' OR role = 'itsm_team'`
        );
        const adminEmails = adminUsersRes.rows.map(u => u.email);

        // 3. 메일 수신자 목록 생성 (중복 제거)
        const recipientEmails = [...new Set([
          ticketDetails.customer_email,
          ticketDetails.assignee_email,
          ...adminEmails
        ].filter(Boolean))]; // null, undefined 값 제거

        // 4. 메일 발송
        if (recipientEmails.length > 0) {
          await sendTicketClosedNotification({
            ticketId: ticketDetails.id,
            title: ticketDetails.title,
            customer_name: ticketDetails.customer_name,
            assignee_name: ticketDetails.assignee_name,
          }, recipientEmails);
          console.log('티켓 종결 알림 메일 발송 완료');
        }

      } catch (emailError) {
        console.error('티켓 종결 알림 메일 발송 실패:', emailError);
      }
    }

    res.json({ 
      message: '상태 변경 완료',
      ticket: updatedTicket
    });
  } catch (err) {
    console.error('상태 변경 오류:', err);
    res.status(500).json({ error: '상태 변경 실패' });
  }
});

module.exports = router;