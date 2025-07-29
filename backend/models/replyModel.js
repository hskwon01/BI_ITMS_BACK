const pool = require('../config/db');

const getRepliesByTicketId = async (ticket_id) => {
  const result = await pool.query(`
    SELECT r.*, u.name AS author_name, u.role
    FROM ticket_replies r
    JOIN users u ON r.author_id = u.id
    WHERE r.ticket_id = $1
    ORDER BY r.created_at ASC
  `, [ticket_id]);

  const replies = result.rows;

  // 각 댓글에 첨부파일 추가
  for (const reply of replies) {
    const filesRes = await pool.query(`
      SELECT id as ticket_reply_files_id, url, originalname FROM ticket_reply_files
      WHERE reply_id = $1
    `, [reply.id]);
    reply.files = filesRes.rows;
  }

  return replies;
};

const addReply = async ({ ticket_id, author_id, message }) => {
  const result = await pool.query(`
    INSERT INTO ticket_replies (ticket_id, author_id, message)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [ticket_id, author_id, message]);
  return result.rows[0];
};

module.exports = { getRepliesByTicketId, addReply };
