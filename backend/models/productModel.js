const pool = require('../config/db');

const listProducts = async ({ limit = 50, offset = 0, category = '', search = '', active_only = true } = {}) => {
  let whereConditions = [];
  let params = [limit, offset];
  let paramCount = 2;

  if (active_only) {
    whereConditions.push('is_active = true');
  }

  if (category && category.trim()) {
    paramCount++;
    whereConditions.push(`category ILIKE $${paramCount}`);
    params.push(`%${category.trim()}%`);
  }

  if (search && search.trim()) {
    paramCount++;
    whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
    params.push(`%${search.trim()}%`);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const listQuery = `
    SELECT id, name, category, description, base_price, unit, is_active, created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY category, name
    LIMIT $1 OFFSET $2
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM products
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

const getProductById = async (id) => {
  const res = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
  return res.rows[0];
};

const createProduct = async ({ name, category, description, base_price, unit = '개', created_by }) => {
  const res = await pool.query(
    `INSERT INTO products (name, category, description, base_price, unit, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, category, description, base_price, unit, created_by]
  );
  return res.rows[0];
};

const updateProduct = async (id, { name, category, description, base_price, unit, is_active }) => {
  const res = await pool.query(
    `UPDATE products SET 
       name = COALESCE($2, name),
       category = COALESCE($3, category),
       description = COALESCE($4, description),
       base_price = COALESCE($5, base_price),
       unit = COALESCE($6, unit),
       is_active = COALESCE($7, is_active),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, name, category, description, base_price, unit, is_active]
  );
  return res.rows[0];
};

const deleteProduct = async (id) => {
  // 실제로는 삭제하지 않고 비활성화
  const res = await pool.query(
    `UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  return res.rows[0];
};

const getCategories = async () => {
  const res = await pool.query(
    `SELECT DISTINCT category FROM products WHERE is_active = true ORDER BY category`
  );
  return res.rows.map(row => row.category);
};

module.exports = { 
  listProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories 
};
