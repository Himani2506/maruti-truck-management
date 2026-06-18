const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const { login, signup, requireAdmin } = require("./auth");
const masterRoutes = require('./routes/master');
const tripsRoutes  = require('./routes/trips');
const scrapRoutes  = require('./routes/scrap');
const alertsRoutes = require('./routes/alerts');

const app  = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Auth
app.post("/auth/login", login);
app.post("/auth/signup", requireAdmin, signup);

// Routes
app.use('/api', masterRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/scrap', scrapRoutes);
app.use('/api/alerts', alertsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Global error handler 
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server — last
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Maruti Trucks API running on http://localhost:${PORT}`);
});