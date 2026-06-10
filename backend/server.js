const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const masterRoutes = require('./routes/master');
const tripsRoutes  = require('./routes/trips');
const scrapRoutes = require('./routes/scrap');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', masterRoutes);   // trucks, sources, customers, backloads
app.use('/api/trips', tripsRoutes);
app.use('/api/scrap', scrapRoutes);

const alertsRoutes = require('./routes/alerts');
app.use('/api/alerts', alertsRoutes);


// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Maruti Trucks API running on http://localhost:${PORT}`);
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});