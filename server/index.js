require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const apiRoutes = require('./routes/api');
const trackingRoutes = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// Webhook routes need raw body (must be before json parser)
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SHOPIFY_API_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files (frontend)
app.use('/public', express.static(path.join(__dirname, '../public')));

// Serve tracking scripts (always accessible - no auth needed)
app.use('/tracking', trackingRoutes);

// API routes (for app frontend)
app.use('/api', apiRoutes);

// Auth routes
app.use('/auth', authRoutes);

// App frontend
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/app.html'));
});

// Health check - always on
app.get('/health', (req, res) => {
  res.json({ status: 'active', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/app');
});

app.listen(PORT, () => {
  console.log(`🚀 Shopify GTM Data Layer Tracker running on port ${PORT}`);
  console.log(`📊 Tracking endpoint: /tracking/datalayer.js`);
  console.log(`🔗 Webhook endpoint: /webhooks`);
  console.log(`⚡ Server-side tracking: ACTIVE`);
});

module.exports = app;
