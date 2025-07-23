// server.js
import express from 'express';
import cron from 'node-cron';
import axios from 'axios';
import { format } from 'date-fns';
import { getFloodPrediction } from './floodPredictor.js';
import 'dotenv/config.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 🌍 18 Cross River LGAs + coords, elevation (m), avg soil moisture (%)
const locations = [
  { name: 'Abi', lat: 5.8667, lon: 8.0167, elev: 120, soil: 47 },
  { name: 'Akamkpa', lat: 5.2945, lon: 8.4958, elev: 60, soil: 50 },
  { name: 'Akpabuyo', lat: 4.9000, lon: 8.5167, elev: 35, soil: 54 },
  { name: 'Bakassi', lat: 4.9260, lon: 8.5290, elev: 3, soil: 58 },
  { name: 'Bekwarra', lat: 6.6833, lon: 8.8833, elev: 190, soil: 43 },
  { name: 'Biase', lat: 5.4167, lon: 8.1667, elev: 85, soil: 52 },
  { name: 'Boki', lat: 6.2385, lon: 8.8965, elev: 230, soil: 55 },
  { name: 'Calabar Municipal', lat: 4.9500, lon: 8.3250, elev: 20, soil: 45 },
  { name: 'Calabar South', lat: 4.9167, lon: 8.3167, elev: 25, soil: 48 },
  { name: 'Etung', lat: 6.0833, lon: 8.8667, elev: 200, soil: 46 },
  { name: 'Ikom', lat: 5.9667, lon: 8.7167, elev: 150, soil: 50 },
  { name: 'Obanliku', lat: 6.9333, lon: 9.3833, elev: 330, soil: 44 },
  { name: 'Obubra', lat: 6.0833, lon: 8.3333, elev: 140, soil: 49 },
  { name: 'Obudu', lat: 6.6700, lon: 9.2200, elev: 280, soil: 42 },
  { name: 'Odukpani', lat: 5.0167, lon: 8.4000, elev: 30, soil: 47 },
  { name: 'Ogoja', lat: 6.6500, lon: 8.8000, elev: 180, soil: 45 },
  { name: 'Yakurr', lat: 5.8667, lon: 8.0167, elev: 110, soil: 48 },
  { name: 'Yala', lat: 6.9000, lon: 8.6833, elev: 160, soil: 46 }
];

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

async function fetchRainfall(lat, lon) {
  const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
              '&daily=precipitation_sum&timezone=Africa/Lagos&forecast_days=7';
  const res = await axios.get(url);
  return res.data.daily;
}

async function processLocation(loc) {
  try {
    const daily = await fetchRainfall(loc.lat, loc.lon);
    const rainfall = daily.precipitation_sum;

    const prediction = await getFloodPrediction({
      location: loc.name,
      rainfall_7_days: rainfall,
      soil_moisture: loc.soil,
      elevation: loc.elev
    });

    if (prediction.likelihood >= 60 && prediction.flood_expected) {
      await axios.post(process.env.NOTIFY_URL, {
        location: loc.name,
        percentage: prediction.likelihood,
        date: prediction.date
      });
      console.log(`✅ Alert sent for ${loc.name}: ${prediction.likelihood}% on ${prediction.date}`);
    } else {
      console.log(`❌ No alert for ${loc.name} (${prediction.likelihood}% on ${prediction.date})`);
    }
  } catch (err) {
    console.error(`Error processing ${loc.name}:`, err.message);
  }
}

// 🕕 Schedule flood checks daily at 6 AM Africa/Lagos
cron.schedule('0 6 * * *', () => {
  console.log(`[${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}] 🔍 Starting flood checks...`);
  locations.forEach(processLocation);
}, { timezone: 'Africa/Lagos' });

// 🔄 Self-ping every 10 minutes to keep alive
cron.schedule('*/10 * * * *', async () => {
  try {
    const res = await axios.get(process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}`);
    console.log(`[${format(new Date(), 'HH:mm:ss')}] 🔄 Keep-alive ping OK`);
  } catch (err) {
    console.error('🔌 Keep-alive ping failed:', err.message);
  }
});

// 🟢 Basic route for uptime check
app.get('/', (req, res) => {
  res.send('🌊 Flood prediction server is alive!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
