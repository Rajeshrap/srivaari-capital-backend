// server.js - Srivaari Capital backend (simple JSON file storage)
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_now';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';

const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], applications: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}
function writeData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

app.use(session({
  name: 'sriv_session',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24*60*60*1000 }
}));

// health
app.get('/api/health', (req, res) => res.json({ ok:true, ts: Date.now() }));

// Signup
app.post('/api/signup', (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!email || !password || !phone) return res.status(400).json({ error: 'Missing email, password or phone' });
    const data = readData();
    const existing = data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hash = bcrypt.hashSync(password, 10);
    const id = Date.now();
    const user = { id, name: name||null, phone, email: email.toLowerCase(), password_hash: hash, created_at: new Date().toISOString() };
    data.users.push(user);
    writeData(data);
    req.session.userId = id;
    req.session.email = user.email;
    res.json({ success:true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const data = readData();
    const user = data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name || null;
    req.session.phone = user.phone || null;
    res.json({ success:true, id: user.id, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error:'Unable to logout' });
    res.json({ success:true });
  });
});

// whoami
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ loggedIn:false });
  return res.json({
    loggedIn: true,
    id: req.session.userId,
    email: req.session.email,
    name: req.session.name,
    phone: req.session.phone
  });
});

// require auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

// apply (protected)
app.post('/api/apply', requireAuth, (req, res) => {
  try {
    const { name, phone, email, address, loan_amount, purpose, monthly_income } = req.body;
    if (!name || !phone || !loan_amount) return res.status(400).json({ error: 'Missing required fields' });
    const data = readData();
    const id = Date.now();
    const row = {
      id,
      user_id: req.session.userId,
      name, phone, email: email||null, address: address||null,
      loan_amount: Number(loan_amount),
      purpose: purpose||null,
      monthly_income: monthly_income ? Number(monthly_income) : null,
      created_at: new Date().toISOString()
    };
    data.applications.push(row);
    writeData(data);
    res.json({ success:true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:'Server error' });
  }
});

// admin: list applications (simple admin pass)
app.get('/api/admin/applications', (req, res) => {
  const pass = req.headers['x-admin-pass'] || '';
  if (pass !== ADMIN_PASS) return res.status(401).json({ error:'Unauthorized' });
  const data = readData();
  res.json({ applications: data.applications });
});

// static
app.get('/', (req, res) => res.send('Srivaari Capital backend is running.'));

// start
app.listen(PORT, () => {
  console.log('Server started on port', PORT);
});
