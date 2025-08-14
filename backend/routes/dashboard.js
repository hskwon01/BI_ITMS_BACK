const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// 관리자 대시보드: 티켓/사용자 통계 (옵션: days, type)
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const type = req.query.type; // 'SR' | 'SM'
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const whereParts = ['created_at >= $1'];
    const params = [since];
    if (type === 'SR' || type === 'SM') {
      whereParts.push('ticket_type = $2');
      params.push(type);
    }
    const where = `WHERE ${whereParts.join(' AND ')}`;

    const result = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM tickets ${where} AND status = '접수'`, params),
      pool.query(`SELECT COUNT(*) FROM tickets ${where} AND status = '진행중'`, params),
      pool.query(`SELECT COUNT(*) FROM tickets ${where} AND status = '답변 완료'`, params),
      pool.query(`SELECT COUNT(*) FROM tickets ${where} AND status = '종료'`, params),
      pool.query(`SELECT COUNT(*) FROM tickets ${where}`, params),
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'customer'`),
      pool.query(`SELECT COUNT(*) FROM users WHERE role = 'admin'`)
    ]);

    res.json({
      접수: result[0].rows[0].count,
      진행중: result[1].rows[0].count,
      답변완료: result[2].rows[0].count,
      종료: result[3].rows[0].count,
      전체티켓: result[4].rows[0].count,
      고객수: result[5].rows[0].count,
      관리자수: result[6].rows[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '대시보드 통계 조회 실패' });
  }
});

// 관리자 대시보드: 일자별 생성 추이 (옵션: days, type)
router.get('/stats/trends', verifyToken, requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days || 30);
    const type = req.query.type; // 'SR' | 'SM'
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const whereParts = ['created_at >= $1'];
    const params = [since];
    if (type === 'SR' || type === 'SM') {
      whereParts.push('ticket_type = $2');
      params.push(type);
    }
    const where = `WHERE ${whereParts.join(' AND ')}`;

    const q = `
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS value
      FROM tickets
      ${where}
      GROUP BY 1
      ORDER BY 1
    `;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '대시보드 추이 조회 실패' });
  }
});

// SLA 자동 종료 처리 기능
router.post('/auto-close', verifyToken, requireAdmin, async (req, res) => {
  try {
    // 1. 답변 완료 상태의 티켓
    const ticketRes = await pool.query(`
      SELECT t.id FROM tickets t
      WHERE t.status = '답변 완료'
    `);

    let closed = 0;

    for (const ticket of ticketRes.rows) {
      const replyRes = await pool.query(
        `SELECT r.*, u.role
        FROM ticket_replies r
        JOIN users u ON r.author_id = u.id
        WHERE r.ticket_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1`,
        [ticket.id]
      );
      const lastReply = replyRes.rows[0];
      if (!lastReply) continue;

      // 2. 마지막 댓글이 관리자이고 7일 지났으면 종료 처리
      const isAdmin = lastReply.role === 'admin';
      const isOld = new Date() - new Date(lastReply.created_at) > 7 * 24 * 60 * 60 * 1000;

      if (isAdmin && isOld) {
        await pool.query(
          `UPDATE tickets SET status = '종료' WHERE id = $1`,
          [ticket.id]
        );
        closed++;
      }
    }

    res.json({ message: `${closed}건 자동 종료 처리됨` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '자동 종료 처리 실패' });
  }
});
module.exports = router;
