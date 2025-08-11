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

const createTicketsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT '접수',
      urgency VARCHAR(50),
      product VARCHAR(255),
      customer_id INTEGER,
      assignee_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      platform VARCHAR(100),
      sw_version VARCHAR(100),
      os VARCHAR(100),
      ticket_type VARCHAR(50) DEFAULT '문의',
      client_company VARCHAR(100)
    );
  `;
  try {
    await pool.query(query);
    console.log('"tickets" table created or already exists.');
  } catch (err) {
    console.error('Error creating "tickets" table:', err);
  }
};

const createTicketFilesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS ticket_files (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER,
      url TEXT,
      originalname TEXT,
      public_id TEXT,
      size INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"ticket_files" table created or already exists.');
  } catch (err) {
    console.error('Error creating "ticket_files" table:', err);
  }
};

const createTicketRepliesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS ticket_replies (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER,
      author_id INTEGER,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"ticket_replies" table created or already exists.');
  } catch (err) {
    console.error('Error creating "ticket_replies" table:', err);
  }
};

const createTicketReplyFilesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS ticket_reply_files (
      id SERIAL PRIMARY KEY,
      reply_id INTEGER,
      url TEXT,
      originalname TEXT,
      public_id TEXT,
      size INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"ticket_reply_files" table created or already exists.');
  } catch (err) {
    console.error('Error creating "ticket_reply_files" table:', err);
  }
};

const addColumnIfNotExists = async (tableName, columnName, columnDefinition) => {
  const checkQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name=$1 AND column_name=$2
  `;
  const { rows } = await pool.query(checkQuery, [tableName, columnName]);

  if (rows.length === 0) {
    const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
    await pool.query(alterQuery);
    console.log(`Column "${columnName}" added to table "${tableName}".`);
  }
};

const setupAllTables = async () => {
  await createAccessRequestsTable();
  await createNoticesTable();
  await createNoticeFilesTable();
  await createTicketsTable();
  await createTicketFilesTable();
  await createTicketRepliesTable();
  await createTicketReplyFilesTable();

  // Add 'size' column to tables if they don't exist
  try {
    await addColumnIfNotExists('ticket_files', 'size', 'INTEGER');
    await addColumnIfNotExists('ticket_reply_files', 'size', 'INTEGER');
  } catch (err) {
    console.error('Error updating table schemas:', err);
  }
};

setupAllTables();
