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

const createNoticesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      author_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notices_created_at_idx ON notices(created_at DESC);
    CREATE INDEX IF NOT EXISTS notices_is_pinned_idx ON notices(is_pinned);
  `;

  try {
    await pool.query(query);
    console.log('"notices" table created or already exists.');
  } catch (err) {
    console.error('Error creating "notices" table:', err);
  }
};

const createNoticesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS notices (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      author_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notices_created_at_idx ON notices(created_at DESC);
    CREATE INDEX IF NOT EXISTS notices_is_pinned_idx ON notices(is_pinned);
  `;

  try {
    await pool.query(query);
    console.log('"notices" table created or already exists.');
  } catch (err) {
    console.error('Error creating "notices" table:', err);
  }
};

const createNoticeFilesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS notice_files (
      id SERIAL PRIMARY KEY,
      notice_id INTEGER NOT NULL,
      url TEXT,
      originalname TEXT,
      public_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS notice_files_notice_id_idx ON notice_files(notice_id);
  `;
  try {
    await pool.query(query);
    console.log('"notice_files" table created or already exists.');
  } catch (err) {
    console.error('Error creating "notice_files" table:', err);
  }
};

createAccessRequestsTable();
createNoticesTable();
createNoticeFilesTable();
createNoticesTable();
