# Maruti Truck Management System

## Prerequisites
- Node.js v18+
- PostgreSQL 14+

---

## 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE maruti_trucks;"

# Run schema + seed
cd backend
node db/setup.js
```

---

## 2. Backend Setup

```bash
cd backend
npm install

# Edit .env — set your DB password
# DB_PASSWORD=your_actual_postgres_password

npm run dev     # development (auto-restart)
# or
npm start       # production
```

Backend runs at: http://localhost:4000

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/trucks | All trucks |
| GET | /api/sources | All sources |
| GET | /api/customers | All customers |
| GET | /api/backloads | All backload options |
| GET | /api/distance | Google Maps distance |
| GET | /api/trips | All trips (filterable) |
| POST | /api/trips | Create trip |
| PATCH | /api/trips/:id | Update trip |
| PATCH | /api/trips/:id/verify | Mark verified |
| GET | /api/trips/export/excel | Download Excel |

---

## Customers with Missing Destinations (fill manually)

Run this SQL to update:

```sql
UPDATE customers SET destination_address='...', destination_lat=XX.XXXX, destination_lng=YY.YYYY
WHERE name = 'HIMSHREE FOODS PVT LTD';

-- Same for:
-- JASHN TRADING HOUSE
-- LAKSHYA POULTRY PVT LTD
-- RAM JANAKI TEL REFINE TATHA PACKAGING UDHYOG PVT . LTD
-- SARAS BEVERAGES PVT. LTD.
-- SHAKTI KALIKA POULTRY PVT LTD
```

---

## Update Driver Names

```sql
UPDATE trucks SET driver_name = 'Driver Name Here' WHERE truck_number = '8596';
-- Repeat for 8597, 8598, 8599, 8600, 0122
```
