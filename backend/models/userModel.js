const pool = require('../config/db');
const crypto = require('crypto');

const createUser = async (email, hashedPassword, name, company) => {
  const result = await pool.query(
    'INSERT INTO users (email, password, name, company_name) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, hashedPassword, name, company]
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const lowercasedEmail = email.toLowerCase(); // 이메일을 소문자로 변환
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [lowercasedEmail]);
  return result.rows[0];
};

const approveUserById = async (id, isApproved = true) => {
  const result = await pool.query(
    'UPDATE users SET is_approved = $1 WHERE id = $2 RETURNING *',
    [isApproved, id]
  );
  return result.rows[0];
};

const getAdminEmails = async () => {
  const result = await pool.query(
    'SELECT email FROM users WHERE role = $1',
    ['admin']
  );
  return result.rows.map(row => row.email);
};

const updateUserById = async (id, updates) => {
  const fields = [];
  const values = [];
  let query = 'UPDATE users SET ';

  let valueCount = 1;
  // Allow updating only name and company_name
  const allowedUpdates = ['name', 'company_name'];

  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${valueCount++}`);
      values.push(updates[field]);
    }
  });

  if (fields.length === 0) {
    throw new Error("수정할 유효한 필드가 없습니다.");
  }

  query += fields.join(', ');
  query += ` WHERE id = $${valueCount} RETURNING *`;
  values.push(id);

  const result = await pool.query(query, values);
  return result.rows[0];
};

const deleteUserById = async (id) => {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  return result.rows[0];
};

// 비밀번호 없이 매직 링크 사용자를 생성하는 함수
const createMagicUser = async (email, name, company) => {
  // 실제 사용되지 않는 임의의 비밀번호 생성
  const randomPassword = crypto.randomBytes(16).toString('hex');
  const result = await pool.query(
    'INSERT INTO users (email, name, company_name, is_approved, role, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [email, name, company, true, 'user', randomPassword] // is_approved를 true, role을 'user'로, 임의의 비밀번호 설정
  );
  return result.rows[0];
};

module.exports = {
  createUser,
  getUserByEmail,
  approveUserById,
  getAdminEmails,
  updateUserById,
  deleteUserById,
  createMagicUser, // 추가
};