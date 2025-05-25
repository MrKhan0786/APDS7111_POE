require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 8) + '...' : 'undefined or empty');

app.enable('trust proxy');

// Security middleware
app.use(helmet());

// Redirect HTTP to HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Enable CORS for all origins - adjust if you want stricter policy
app.use(cors({ origin: '*' }));

// Built-in express JSON parser (body-parser is actually no longer needed for JSON)
app.use(express.json());

// DB config & connection pool
let dbConfig = null;
let pool = null;

async function loadDbCredentials() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const secret_name = process.env.AWS_SECRET_NAME;

  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secret_name }));
    const secret = JSON.parse(response.SecretString);

    dbConfig = {
      user: secret.username,
      password: secret.password,
      server: secret.host,
      database: secret.dbname,
      options: { encrypt: true, trustServerCertificate: true },
    };

    console.log('✅ DB credentials loaded from AWS Secrets Manager');
  } catch (err) {
    console.warn('⚠️ Falling back to .env DB config:', err.message);
    dbConfig = {
      user: process.env.AZURE_DB_USER,
      password: process.env.AZURE_DB_PASSWORD,
      server: process.env.AZURE_DB_SERVER,
      database: process.env.AZURE_DB_NAME,
      options: { encrypt: true, trustServerCertificate: true },
    };
  }
}

async function initDb() {
  await loadDbCredentials();
  pool = await sql.connect(dbConfig);
}
initDb();

async function getConnection() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// Utility function to validate strong password
function isStrongPassword(password) {
  // At least 8 chars, one uppercase, one lowercase, one digit, one special char
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}

// Audit log helper
async function logEvent(username, event, ip) {
  try {
    const pool = await getConnection();
    await pool.request()
      .input('username', sql.VarChar, username)
      .input('event', sql.VarChar, event)
      .input('ip_address', sql.VarChar, ip)
      .query(`INSERT INTO audit_logs (username, event, ip_address, timestamp)
              VALUES (@username, @event, @ip_address, GETDATE())`);
  } catch (err) {
    console.error('❌ Audit log error:', err.message);
  }
}

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again after 15 minutes',
});

// Regex Validators
const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const amountRegex = /^\d+(\.\d{1,2})?$/;
const cardNumberRegex = /^\d{13,19}$/;
const expiryRegex = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/;
const cvvRegex = /^\d{3,4}$/;

// Routes

// Register new user
app.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ message: 'Username, password, and email are required' });
    }

    if (!usernameRegex.test(username)) {
      return res.status(400).json({ message: 'Username must be 3-20 alphanumeric characters.' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      });
    }

    const pool = await getConnection();

    const existingUser = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM users1 WHERE username = @username');

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.request()
      .input('username', sql.VarChar, username)
      .input('password_hash', sql.VarChar, hashedPassword)
      .input('email', sql.VarChar, email)
      .query(`INSERT INTO users1 (username, password_hash, email, created_at)
              VALUES (@username, @password_hash, @email, GETDATE())`);

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await logEvent(username, 'registration', req.ip);

    res.status(201).json({ message: 'User registered successfully', token });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User login
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM users1 WHERE username = @username');

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    const now = new Date();

    if (user.lockout_until && now < user.lockout_until) {
      return res.status(403).json({ message: 'Account is temporarily locked. Please try again later.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const failedAttempts = (user.failed_attempts || 0) + 1;
      let lockoutUntil = null;

      if (failedAttempts >= 5) {
        lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000);
      }

      await pool.request()
        .input('username', sql.VarChar, username)
        .input('failed_attempts', sql.Int, failedAttempts)
        .input('lockout_until', sql.DateTime, lockoutUntil)
        .query(`UPDATE users1 SET failed_attempts = @failed_attempts, lockout_until = @lockout_until WHERE username = @username`);

      await logEvent(username, 'login_failed', req.ip);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Reset failed attempts on successful login
    await pool.request()
      .input('username', sql.VarChar, username)
      .query(`UPDATE users1 SET failed_attempts = 0, lockout_until = NULL WHERE username = @username`);

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await logEvent(username, 'login_success', req.ip);

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Payment processing endpoint (store payment info securely)
app.post('/api/payment', async (req, res) => {
  const { username, fullName, cardNumber, expiry, cvv, amount } = req.body;

  if (!username || !fullName || !cardNumber || !expiry || !cvv || !amount) {
    return res.status(400).json({ message: 'All payment fields are required.' });
  }

  if (!amountRegex.test(amount.toString())) {
    return res.status(400).json({ message: 'Amount must be a valid number with up to 2 decimals.' });
  }

  if (!cardNumberRegex.test(cardNumber)) {
    return res.status(400).json({ message: 'Card number must be 13 to 19 digits.' });
  }

  if (!expiryRegex.test(expiry)) {
    return res.status(400).json({ message: 'Expiry date must be in MM/YY or MM/YYYY format.' });
  }

  if (!cvvRegex.test(cvv)) {
    return res.status(400).json({ message: 'CVV must be 3 or 4 digits.' });
  }

  try {
    const pool = await getConnection();

    await pool.request()
      .input('username', sql.VarChar, username)
      .input('full_name', sql.VarChar, fullName)
      .input('card_number', sql.VarChar, cardNumber)
      .input('expiry_date', sql.VarChar, expiry)
      .input('cvv', sql.VarChar, cvv)
      .input('amount', sql.Decimal(18, 2), amount)
      .input('payment_status', sql.VarChar, 'Pending')
      .query(`INSERT INTO payments (username, full_name, card_number, expiry_date, cvv, amount, payment_status, payment_date)
              VALUES (@username, @full_name, @card_number, @expiry_date, @cvv, @amount, @payment_status, GETDATE())`);

    await logEvent(username, 'payment_initiated', req.ip);

    res.status(201).json({ message: 'Payment initiated successfully' });
  } catch (err) {
    console.error('❌ Payment error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch transactions for user
app.get('/api/transactions/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM payments WHERE username = @username ORDER BY payment_date DESC');

    res.json({ transactions: result.recordset });
  } catch (err) {
    console.error('❌ Fetch transactions error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Stripe webhook endpoint - verify and handle events
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`💰 PaymentIntent was successful! ID: ${paymentIntent.id}`);
      break;
    // Add other event types as needed
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error('❌ Uncaught error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start HTTPS server (ensure certs are in correct path)
if (process.env.NODE_ENV === 'production') {
  const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem'),
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`🚀 HTTPS Server running on port ${PORT}`);
  });
} else {
  // In development, just use HTTP
  app.listen(PORT, () => {
    console.log(`🚀 HTTP Server running on port ${PORT}`);
  });
}
