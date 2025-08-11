const pool = require('../config/db');

const listNotices = async ({ limit = 20, offset = 0, keyword = '' } = {}) => {
  const where = keyword ? `WHERE title ILIKE $3 OR content ILIKE $3` : '';
  const params = keyword ? [limit, offset, `%${keyword}%`] : [limit, offset];
  const listQuery = `
    SELECT id, title, content, is_pinned, author_id, created_at, updated_at
    FROM notices
    ${where}
    ORDER BY is_pinned DESC, created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM notices
    ${where}
  `;
  const [listRes, countRes] = await Promise.all([
    pool.query(listQuery, params),
    pool.query(countQuery, keyword ? [params[2]] : [])
  ]);
  return { items: listRes.rows, total: countRes.rows[0]?.total || 0 };
};

const getNoticeById = async (id) => {
  const res = await pool.query(`SELECT * FROM notices WHERE id = $1`, [id]);
  return res.rows[0];
};

const createNotice = async ({ title, content, is_pinned = false, author_id = null }) => {
  const res = await pool.query(
    `INSERT INTO notices (title, content, is_pinned, author_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, content, is_pinned, author_id]
  );
  return res.rows[0];
};

const updateNotice = async (id, { title, content, is_pinned }) => {
  const res = await pool.query(
    `UPDATE notices SET 
       title = COALESCE($2, title),
       content = COALESCE($3, content),
       is_pinned = COALESCE($4, is_pinned),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, title, content, is_pinned]
  );
  return res.rows[0];
};

const deleteNotice = async (id) => {
  const res = await pool.query(`DELETE FROM notices WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0];
};

module.exports = { listNotices, getNoticeById, createNotice, updateNotice, deleteNotice };

