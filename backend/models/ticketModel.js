const pool = require('../config/db');

const createTicket = async ({ title, description, urgency, product, customer_id, platform, sw_version, os }) => {
  const result = await pool.query(
    `INSERT INTO tickets (title, description, urgency, product, customer_id, platform, sw_version, os)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, description, urgency, product, customer_id, platform, sw_version, os]
  );
  return result.rows[0];
};


module.exports = { createTicket };
