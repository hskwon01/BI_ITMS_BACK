const pool = require('../config/db');

const createTicket = async ({ title, description, urgency, product, customer_id, platform, sw_version, os, status = '접수', ticket_type, client_company }) => {
  const result = await pool.query(
    `INSERT INTO tickets (title, description, urgency, product, customer_id, platform, sw_version, os, status, ticket_type, client_company)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [title, description, urgency, product, customer_id, platform, sw_version, os, status, ticket_type, client_company]
  );
  return result.rows[0];
};

const assignTicket = async (ticketId, assigneeId) => {
  const result = await pool.query(
    `UPDATE tickets SET assignee_id = $1 WHERE id = $2 RETURNING *`,
    [assigneeId, ticketId]
  );
  return result.rows[0];
};

module.exports = { createTicket, assignTicket };
