// server.js - Srivaari Capital backend (improved for session reliability)
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_now';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'; // set to your frontend origin
const NODE_ENV = process.env.NODE_ENV || 'development';

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

// CORS - allow only the frontend origin (important when credentials are used)
app.use(cors({
  origin: (origin, cb) => {
    // allow if no origin (e.g., curl / server-to-server) OR matches FRONTEND_ORIGIN
    if (!origin || origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));

app.use(bodyParser.json());

// Session store (persistent file store). Replace with redis for production-scale.
const isProduction = NODE_ENV === 'production';
app.use(session({
  name: 'srivaari.sid',
  store: new FileStore({ path: path.join(__dirname, 'sessions') }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,                      // must be true in production (HTTPS)
    maxAge: 24 * 60 * 60 * 1000,              // 1 day
    sameSite: isProduction ? 'none' : 'lax'   // 'none' for cross-site in prod; 'lax' for local dev
  }
}));

// simple request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - origin: ${req.headers.origin || 'none'}`);
  next();
});

// health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Signup
app.post('/api/signup', (req, res) => {
  try {
    const { name, phon

