require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = require('mssql'); // ✅ Corrected to use mssql
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'https://your-production-site.com'], methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(bodyParser.json());

let dbConfig = null;
let pool = null;

// ===== Load DB Credentials from AWS Secrets Manager =====
async function loadDbCredentials() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const secret_name = process.env.AWS_SECRET_NAME;

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: 'AWSCURRENT',
      })
    );

    const secret = JSON.parse(response.SecretString);

    dbConfig = {
      user: secret.username,
      password: secret.password,
      server: secret.host,
      database: secret.dbname,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };

    console.log('✅ DB credentials loaded from AWS Secrets Manager');
  } catch (err) {
    console.warn('⚠️ Falling back to .env DB config due to error loading secrets:', err.message);

    dbConfig = {
      user: process.env.AZURE_DB_USER,
      password: process.env.AZURE_DB_PASSWORD,
      server: process.env.AZURE_DB_SERVER,
      database: process.env.AZURE_DB_NAME,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };
  }
}

// ===== Get SQL Connection (reuse pool) =====
async function getConnection() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// ===== WebSocket Server =====
const wsServer = new WebSocket.Server({ noServer: true });

wsServer.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  ws.on('message', (message) => {
    console.log('Received message:', message);
  });

  ws.send('Hello from WebSocket server');
});

app.server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// Upgrade the HTTP server to support WebSockets
app.server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (ws) => {
    wsServer.emit('connection', ws, request);
  });
});

// ===== Root Endpoint =====
app.get('/', (req, res) => {
  res.send('🚀 Backend server is running! Customer Portal API.');
});

// ===== Health Check =====
app.get('/health', async (req, res) => {
  try {
    const pool = await getConnection();
    res.status(200).json({ status: 'OK', dbStatus: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'DB Connection Error' });
  }
});

// ===== User Registration =====
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM users WHERE username = @username');

    if (result.recordset.length > 0) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, hashedPassword)
      .query('INSERT INTO users (username, password) VALUES (@username, @password)');

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: 'User registered successfully', token });
  } catch (err) {
    console.error('❌ Registration error:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== User Login =====
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM users WHERE username = @username');

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('❌ Login error:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== Handle Payment Submission =====
app.post('/api/payment', async (req, res) => {
  const { username, fullName, cardNumber, expiry, cvv, amount } = req.body;

  try {
    const pool = await getConnection();

    const insertResult = await pool.request()
      .input('username', sql.VarChar, username)
      .input('full_name', sql.VarChar, fullName)
      .input('card_number', sql.VarChar, cardNumber)
      .input('expiry_date', sql.VarChar, expiry)
      .input('cvv', sql.VarChar, cvv)
      .input('amount', sql.Decimal(10, 2), amount)
      .input('payment_status', sql.VarChar, 'Pending')
      .query(`INSERT INTO payments (username, full_name, card_number, expiry_date, cvv, amount, payment_status)
              OUTPUT INSERTED.id
              VALUES (@username, @full_name, @card_number, @expiry_date, @cvv, @amount, @payment_status)`);

    const paymentId = insertResult.recordset[0].id;

    await pool.request()
      .input('id', sql.Int, paymentId)
      .input('status', sql.VarChar, 'Success')
      .query('UPDATE payments SET payment_status = @status WHERE id = @id');

    // Notify WebSocket clients about the successful payment
    wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event: 'payment_status', status: 'Success' }));
      }
    });

    res.status(200).json({ success: true, message: 'Payment was successful!' });
  } catch (err) {
    console.error('❌ Payment error:', err.message || err);
    res.status(500).json({ message: 'Error processing payment.' });
  }
});

// ===== Fetch Users Data =====
app.get('/api/users', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM users');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Fetch Payments Data =====
app.get('/api/payments', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM payments');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Start Server =====
loadDbCredentials()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to load DB credentials:', err.message || err);
  });
