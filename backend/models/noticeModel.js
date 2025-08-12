const pool = require('../config/db');

const listNotices = async ({ limit = 20, offset = 0, keyword = '' } = {}) => {
  let listQuery, countQuery, listParams, countParams;
  
  if (keyword && keyword.trim()) {
    // 키워드가 있는 경우
    const searchPattern = `%${keyword.trim()}%`;
    listQuery = `
      SELECT id, title, content, is_pinned, author_id, created_at, updated_at
      FROM notices
      WHERE title ILIKE $3 OR content ILIKE $3
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT $1 OFFSET $2
    `;
    countQuery = `
      SELECT COUNT(*)::int AS total
      FROM notices
      WHERE title ILIKE $1 OR content ILIKE $1
    `;
    listParams = [limit, offset, searchPattern];
    countParams = [searchPattern];
  } else {
    // 키워드가 없는 경우
    listQuery = `
      SELECT id, title, content, is_pinned, author_id, created_at, updated_at
      FROM notices
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT $1 OFFSET $2
    `;
    countQuery = `
      SELECT COUNT(*)::int AS total
      FROM notices
    `;
    listParams = [limit, offset];
    countParams = [];
  }
  
  const [listRes, countRes] = await Promise.all([
    pool.query(listQuery, listParams),
    pool.query(countQuery, countParams)
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

