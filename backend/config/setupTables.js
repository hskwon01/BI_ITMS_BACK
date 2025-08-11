const pool = require('./db');

const createAccessRequestsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS access_requests (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, denied, used
      magic_token VARCHAR(255),
      magic_token_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  try {
    await pool.query(query);
    console.log('"access_requests" table created or already exists.');
  } catch (err) {
    console.error('Error creating "access_requests" table:', err);
  }
};

createAccessRequestsTable();
