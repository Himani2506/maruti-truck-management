const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

// GET /api/distance?origin_lat=&origin_lng=&dest_lat=&dest_lng=
// Returns distance in KM between source and destination via Google Maps
router.get('/distance', async (req, res) => {
  const { origin_lat, origin_lng, dest_lat, dest_lng } = req.query;

  if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
    return res.status(400).json({ error: 'Missing coordinates. Provide origin_lat, origin_lng, dest_lat, dest_lng.' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;

  try {
    const response = await axios.get(url, {
      params: {
        origins: `${origin_lat},${origin_lng}`,
        destinations: `${dest_lat},${dest_lng}`,
        mode: 'driving',
        key: apiKey,
      },
    });

    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(500).json({ error: `Google Maps error: ${data.status}` });
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      return res.status(500).json({ error: 'Could not calculate distance for this route.' });
    }

    const distanceMeters = element.distance.value;
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    const durationText = element.duration.text;

    res.json({
      distance_km: distanceKm,
      duration: durationText,
      origin: data.origin_addresses[0],
      destination: data.destination_addresses[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
