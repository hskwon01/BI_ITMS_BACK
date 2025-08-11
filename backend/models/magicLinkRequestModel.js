const pool = require('../config/db');

// 새로운 접근 요청 생성
const createRequest = async (email, name, company) => {
  const result = await pool.query(
    'INSERT INTO access_requests (email, name, company_name, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, name, company, 'pending']
  );
  return result.rows[0];
};

// 이메일로 요청 찾기
const getRequestByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM access_requests WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0];
};

// ID로 요청 찾기
const getRequestById = async (id) => {
  const result = await pool.query('SELECT * FROM access_requests WHERE id = $1', [id]);
  return result.rows[0];
};

// 모든 승인 대기 중인 요청 가져오기
const getPendingRequests = async () => {
  const result = await pool.query("SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at DESC");
  return result.rows;
};

// 상태별 요청 목록 가져오기
const getRequestsByStatus = async (status) => {
  const result = await pool.query('SELECT * FROM access_requests WHERE status = $1 ORDER BY created_at DESC', [status]);
  return result.rows;
};

// 모든 요청 목록 가져오기
const getAllRequests = async () => {
  const result = await pool.query('SELECT * FROM access_requests ORDER BY created_at DESC');
  return result.rows;
};

// 요청 승인
const approveRequestById = async (id) => {
  const result = await pool.query(
    "UPDATE access_requests SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// 요청 거부
const rejectRequestById = async (id) => {
  const result = await pool.query(
    "UPDATE access_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

// 매직 링크 토큰 저장
const setMagicToken = async (email, token, expiresAt) => {
  const result = await pool.query(
    'UPDATE access_requests SET magic_token = $1, magic_token_expires_at = $2, updated_at = NOW() WHERE email = $3 AND status = $4 RETURNING *',
    [token, expiresAt, email.toLowerCase(), 'approved']
  );
  return result.rows[0];
};

// 유효한 토큰으로 요청 찾기
const getRequestByValidToken = async (token) => {
  const result = await pool.query(
    `SELECT ar.*, u.role 
     FROM access_requests ar
     LEFT JOIN users u ON ar.email = u.email
     WHERE ar.magic_token = $1 AND ar.magic_token_expires_at > NOW()`,
    [token]
  );
  return result.rows[0];
};

// 토큰 무효화
const invalidateToken = async (token) => {
  await pool.query(
    "UPDATE access_requests SET magic_token = NULL, magic_token_expires_at = NULL, status = 'used', updated_at = NOW() WHERE magic_token = $1",
    [token]
  );
};

module.exports = {
  createRequest,
  getRequestByEmail,
  getRequestById,
  getPendingRequests,
  getRequestsByStatus,
  getAllRequests,
  approveRequestById,
  rejectRequestById, // 추가
  setMagicToken,
  getRequestByValidToken,
  invalidateToken,
};
