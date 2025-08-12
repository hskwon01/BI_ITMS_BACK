const pool = require('../config/db');

const listQuotes = async ({ limit = 20, offset = 0, customer_id = null, status = '', search = '' } = {}) => {
  let whereConditions = [];
  let params = [limit, offset];
  let paramCount = 2;

  if (customer_id) {
    paramCount++;
    whereConditions.push(`customer_id = $${paramCount}`);
    params.push(customer_id);
  }

  if (status && status.trim()) {
    paramCount++;
    whereConditions.push(`status = $${paramCount}`);
    params.push(status.trim());
  }

  if (search && search.trim()) {
    paramCount++;
    whereConditions.push(`(title ILIKE $${paramCount} OR customer_name ILIKE $${paramCount} OR customer_company ILIKE $${paramCount})`);
    params.push(`%${search.trim()}%`);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const listQuery = `
    SELECT id, customer_id, customer_name, customer_email, customer_company, 
           title, status, total_amount, valid_until, created_at, updated_at
    FROM quotes
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM quotes
    ${whereClause}
  `;

  const countParams = params.slice(2); // limit, offset 제외

  const [listRes, countRes] = await Promise.all([
    pool.query(listQuery, params),
    pool.query(countQuery, countParams)
  ]);

  return { 
    items: listRes.rows, 
    total: countRes.rows[0]?.total || 0 
  };
};

const getQuoteById = async (id) => {
  const quoteRes = await pool.query(`SELECT * FROM quotes WHERE id = $1`, [id]);
  const quote = quoteRes.rows[0];
  
  if (!quote) return null;

  // 견적 항목들도 함께 가져오기
  const itemsRes = await pool.query(
    `SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY id`,
    [id]
  );
  quote.items = itemsRes.rows;

  return quote;
};

const createQuote = async ({ customer_id, customer_name, customer_email, customer_company, title, valid_until, notes }) => {
  const res = await pool.query(
    `INSERT INTO quotes (customer_id, customer_name, customer_email, customer_company, title, valid_until, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [customer_id, customer_name, customer_email, customer_company, title, valid_until, notes]
  );
  return res.rows[0];
};

const updateQuote = async (id, { title, status, valid_until, notes, total_amount }) => {
  const res = await pool.query(
    `UPDATE quotes SET 
       title = COALESCE($2, title),
       status = COALESCE($3, status),
       valid_until = COALESCE($4, valid_until),
       notes = COALESCE($5, notes),
       total_amount = COALESCE($6, total_amount),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, title, status, valid_until, notes, total_amount]
  );
  return res.rows[0];
};

const deleteQuote = async (id) => {
  // 견적 항목들도 함께 삭제
  await pool.query(`DELETE FROM quote_items WHERE quote_id = $1`, [id]);
  
  const res = await pool.query(`DELETE FROM quotes WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0];
};

// 견적 항목 관련 함수들
const addQuoteItem = async ({ quote_id, product_id, product_name, product_description, quantity, unit_price }) => {
  const total_price = quantity * unit_price;
  
  const res = await pool.query(
    `INSERT INTO quote_items (quote_id, product_id, product_name, product_description, quantity, unit_price, total_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [quote_id, product_id, product_name, product_description, quantity, unit_price, total_price]
  );
  
  // 견적서 총액 업데이트
  await updateQuoteTotalAmount(quote_id);
  
  return res.rows[0];
};

const updateQuoteItem = async (id, { quantity, unit_price, product_description }) => {
  const total_price = quantity * unit_price;
  
  const res = await pool.query(
    `UPDATE quote_items SET 
       quantity = COALESCE($2, quantity),
       unit_price = COALESCE($3, unit_price),
       product_description = COALESCE($4, product_description),
       total_price = $5
     WHERE id = $1 RETURNING *`,
    [id, quantity, unit_price, product_description, total_price]
  );
  
  if (res.rows[0]) {
    // 견적서 총액 업데이트
    await updateQuoteTotalAmount(res.rows[0].quote_id);
  }
  
  return res.rows[0];
};

const deleteQuoteItem = async (id) => {
  const itemRes = await pool.query(`SELECT quote_id FROM quote_items WHERE id = $1`, [id]);
  const quote_id = itemRes.rows[0]?.quote_id;
  
  const res = await pool.query(`DELETE FROM quote_items WHERE id = $1 RETURNING id`, [id]);
  
  if (quote_id) {
    // 견적서 총액 업데이트
    await updateQuoteTotalAmount(quote_id);
  }
  
  return res.rows[0];
};

const updateQuoteTotalAmount = async (quote_id) => {
  const res = await pool.query(
    `SELECT SUM(total_price) as total FROM quote_items WHERE quote_id = $1`,
    [quote_id]
  );
  
  const total_amount = res.rows[0]?.total || 0;
  
  await pool.query(
    `UPDATE quotes SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
    [total_amount, quote_id]
  );
  
  return total_amount;
};

module.exports = { 
  listQuotes, 
  getQuoteById, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
  updateQuoteTotalAmount
};


