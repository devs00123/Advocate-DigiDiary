# Advocate DigiDiary — Enterprise Legal Practice Management & Court Diary

Advocate DigiDiary is a production-grade Legal Practice Management and Digital Court Diary platform designed specifically for Senior Counsels, Advocates, and Chambers across High Courts, the Supreme Court of India, and District Courts.

Built strictly in adherence to the authoritative **Google Stitch** design system, this platform delivers an elite legal workspace with zero compromises on tenant security, real-time data integrity, and compliance.

---

## Key Highlights & Architectural Principles

1. **Stitch Visual Source of Truth**:
   - Faithful recreation of Google Stitch layouts, tokens, and aesthetic hierarchy.
   - Sovereign Navy (`#0A1128`), Antique Brass (`#C59B27`), Deep Chamber Navy (`#101B3B`), and Off-White / Card Slate palettes.
   - Typography: `Playfair Display` for major headings, `Inter` for body & data density, and `Plus Jakarta Sans` for labels.

2. **Absolute No-Document-Storage Rule**:
   - Zero document storage, no file uploads, no document vault, no file attachments, and no document preview subsystem.
   - Case details are strictly structured into **7 core sections**:
     1. **Overview**
     2. **Timeline**
     3. **Hearings**
     4. **Tasks**
     5. **Notes** (Text-only research notes & statutory citations)
     6. **Financial Summary**
     7. **Activity**
   - Generated reports (Cause lists, Case summaries, Fee ledgers) are compiled and streamed directly to HTTP responses on the fly — never persisted to disk.

3. **Multi-Tenant Cryptographic Data Isolation**:
   - Every tenant-owned MongoDB collection enforces `lawFirmId`.
   - The server derives `lawFirmId` exclusively from the authenticated JWT session (`req.user.lawFirmId`), completely ignoring any client-sent spoofed IDs.
   - Cross-firm isolation is verified by automated test suites.

4. **Production Database Discipline**:
   - MongoDB Atlas is required in production via `MONGODB_URI`.
   - In production (`NODE_ENV=production`), missing `MONGODB_URI` or database connection failure terminates the process with `process.exit(1)`. No silent in-memory fallback.
   - In-memory database (`mongodb-memory-server`) is used strictly for automated tests.

5. **Server-Side Financial Accuracy**:
   - All financial calculations (Total Billed, Total Collected, Outstanding Receivables, Client Balances) are computed on the backend using MongoDB aggregation pipelines.

6. **Full-Stack Vanilla Architecture**:
   - Frontend: Clean semantic HTML5, Vanilla CSS3 (Custom Design System matching Stitch), Vanilla JavaScript. Zero frontend frameworks (No React/Vue).
   - Backend: Node.js, Express.js, MongoDB Atlas (Mongoose).

---

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Required in Production | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production`, `development`, or `test` |
| `PORT` | Optional (default: 5000) | Server port |
| `MONGODB_URI` | **YES** | MongoDB Atlas connection string |
| `JWT_SECRET` | **YES** | Cryptographic secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Optional (default: `7d`) | Token expiration window |
| `APP_URL` | Yes | Public application URL for password reset links |
| `CORS_ORIGIN` | Optional | Allowed CORS origin |

> [!CAUTION]
> Never commit `.env` or expose production Atlas credentials in version control.

---

## Development & Seed Data Safety

Install dependencies:

```bash
npm install
```

### Seeding Practice Data (Development Only)

To populate sample advocates, cases, cause lists, and ledger records for local exploration:

```bash
npm run seed
```

> [!WARNING]
> The seed script is hard-coded to reject execution in production (`if (process.env.NODE_ENV === 'production') process.exit(1)`). Do NOT run seeds against production Atlas clusters.

Default development credentials created by the seed:
- **Email**: `rajesh@singhania.law`
- **Password**: `Advocate@2026`
- **Firm**: Singhania & Partners LLP

---

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
export NODE_ENV=production
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/advocate_digidiary?retryWrites=true&w=majority"
export JWT_SECRET="your_production_secure_secret_here"
export APP_URL="https://diary.yourchambers.law"
npm start
```

Access the application in your browser:
```
http://localhost:5000
```

---

## Automated Test Suite

The test suite validates Authentication, Multi-Tenant Data Isolation, Super Admin Telemetry & Governance, Entity CRUD workflows, Real Financial Balances, and On-the-fly Streaming Reports:

```bash
npm test
```

4 Test Suites, 36 automated unit and integration tests passing cleanly (`auth.test.js`, `tenant_isolation.test.js`, `crud_and_reports.test.js`, `admin.test.js`).

---

## Super Admin & Platform Telemetry Console

Root administrators with the `admin` role can access the dedicated platform telemetry console at:
```
/admin.html
```

### Super Admin Features:
- **Telemetry Dashboard:** Live advocate roster counts, total platform views, active concurrent lawyers, sticky retention ratio, and storage footprint.
- **Hourly Traffic & Docket Rush:** Visualizing judicial traffic spikes between 09:00 AM - 11:30 AM (Cause list call) and 04:00 PM - 06:00 PM (Reconciliation).
- **Module Breakdown:** Real-time distribution across Cause List, Case Portfolio, Fee Ledger, and Legal Notes.
- **Advocate Roster Governance:** Multi-jurisdiction filtering, account status tracking, active cases, and view counts.
- **Live Event Feed:** Real-time encrypted audit stream piped directly from the MongoDB cluster.
- **Quick Action Tools:**
  - **Export Audit (CSV):** Streams immutable audit logs directly to CSV.
  - **Generate Health Report:** Real-time diagnostic modal for database connectivity, Node.js process uptime, memory usage, and collection document census.
  - **Purge Stale:** Safely cleanses temporary expired sessions.
  - **Invite Chamber Head:** Immediate onboarding modal for new advocates and law chambers.

---

## Production Deployment Checklist

- [x] Set `NODE_ENV=production`
- [x] Configure production `MONGODB_URI` on MongoDB Atlas
- [x] Generate a secure 64-character random `JWT_SECRET`
- [x] Ensure secure HTTPS termination (enables `Secure` cookie flag)
- [x] Health check endpoint available at `GET /api/health`
- [x] Super Admin diagnostics at `GET /api/admin/health-report`
- [x] Seed script disabled in production
- [x] Security headers enforced via Helmet & SameSite cookies
