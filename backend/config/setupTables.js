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

// 제품 테이블 생성
const createProductsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description TEXT,
      base_price DECIMAL(15,2) NOT NULL,
      unit VARCHAR(50) DEFAULT '개',
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"products" table created or already exists.');
  } catch (err) {
    console.error('Error creating "products" table:', err);
  }
};

// 견적서 테이블 생성
const createQuotesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS quotes (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      customer_company VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      total_amount DECIMAL(18,2),
      valid_until DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"quotes" table created or already exists.');
  } catch (err) {
    console.error('Error creating "quotes" table:', err);
  }
};

// 견적 항목 테이블 생성
const createQuoteItemsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS quote_items (
      id SERIAL PRIMARY KEY,
      quote_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name VARCHAR(255) NOT NULL,
      product_description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(15,2) NOT NULL,
      total_price DECIMAL(18,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
    console.log('"quote_items" table created or already exists.');
  } catch (err) {
    console.error('Error creating "quote_items" table:', err);
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
  await createProductsTable();
  await createQuotesTable();
  await createQuoteItemsTable();

  // Add 'size' column to tables if they don't exist
  try {
    await addColumnIfNotExists('ticket_files', 'size', 'INTEGER');
    await addColumnIfNotExists('ticket_reply_files', 'size', 'INTEGER');
  } catch (err) {
    console.error('Error updating table schemas:', err);
  }

  // Update decimal precision for price fields
  try {
    await pool.query('ALTER TABLE products ALTER COLUMN base_price TYPE DECIMAL(15,2)');
    console.log('Updated products.base_price precision');
  } catch (err) {
    console.log('Products table base_price column already updated or does not exist');
  }

  try {
    await pool.query('ALTER TABLE quotes ALTER COLUMN total_amount TYPE DECIMAL(18,2)');
    console.log('Updated quotes.total_amount precision');
  } catch (err) {
    console.log('Quotes table total_amount column already updated or does not exist');
  }

  try {
    await pool.query('ALTER TABLE quote_items ALTER COLUMN unit_price TYPE DECIMAL(15,2)');
    await pool.query('ALTER TABLE quote_items ALTER COLUMN total_price TYPE DECIMAL(18,2)');
    console.log('Updated quote_items price columns precision');
  } catch (err) {
    console.log('Quote_items table price columns already updated or do not exist');
  }
};

setupAllTables();
