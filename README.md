# Kaduna Polytechnic (KadPoly) Cloud Attendance Management System

A production-grade, full-stack, cloud-based attendance management and examination clearance system built specifically for **Kaduna Polytechnic (KadPoly)**. Developed with React 19, TypeScript, Tailwind CSS, an Express REST API, and a centralized relational database with SQLite / sql.js, transactional atomicity, duplicate submission prevention, tamper-evident audit logging, and authentic PDF/Excel report generation.

---

## 🏛️ System Overview

The system models the operational hierarchy of Kaduna Polytechnic (Colleges, Departments, ND/HND programs, and Academic Sessions) and implements the Nigerian Polytechnic 75% minimum lecture attendance clearance rule for semester examinations.

### Key Capabilities

1. **Role-Based Access Control (RBAC)**:
   - **Administrator**: Institutional governance across departments, academic sessions, curriculum courses, faculty assignments, user accounts, audit logging, and global threshold settings.
   - **Lecturer**: View assigned courses, view enrolled students, mark attendance with duplicate prevention, review student correction requests, edit records with audit reasons, and export official registers.
   - **Student**: View registered courses, real-time attendance percentage, 75% exam clearance gauge, self-register courses, inspect lecture-by-lecture history, and submit documented correction appeals.

2. **Attendance Accuracy & 75% Examination Clearance Rule**:
   - Standard Academic Board formula:
     $$\text{Attendance Rate} = \frac{\text{Present} + (\text{Late} \times \text{Weight})}{\text{Total Lectures Delivered}} \times 100\%$$
   - Students with $<75\%$ attendance are automatically flagged with warning alerts and barred from the exam list.

3. **Database Integrity & Duplicate Prevention**:
   - Foreign key constraints with cascading logic.
   - Unique constraints prevent duplicate lecture sessions (`course_id`, `date`, `start_time`) and duplicate student records within a lecture session.
   - Transactional safety: batch lecture attendance submits atomically via SQLite savepoints.

4. **Institutional Reports (CSV & PDF for Offline Record-Keeping)**:
   - **CSV Export (`/api/reports/csv` & `/api/reports/institutional-csv`)**: Generates standard RFC 4180 `.csv` registers containing course metadata, student Matriculation numbers, names, per-lecture attendance matrices, totals, attendance percentages, and examination clearance statuses for offline analysis in Excel, LibreOffice, or data pipelines.
   - **PDF Official Registers (`/api/reports/pdf`)**: Generates official `.pdf` registers with Kaduna Polytechnic dark green header banner, attendance breakdown, and sign-off blocks for the Course Lecturer, Head of Department (HOD), and Academic Secretary.
   - **Excel Spreadsheets (`/api/reports/excel`)**: Generates formatted `.xlsx` workbooks with multiple columns and summary metrics.

5. **Tamper-Evident Audit Logs**:
   - Every sensitive event (registration, login, marking attendance, updating records, approving corrections, creating courses) is logged with timestamp, user ID, IP address, entity, and action.

---

## 🔑 Pre-Configured Test Accounts

The system includes pre-seeded test accounts for instant evaluation:

| Role | Email | Password | Name & Title |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@kadpoly.edu.ng` | `AdminPass123!` | Engr. Dr. Suleiman Aliyu (Director of Academic Planning) |
| **Lecturer** | `lecturer@kadpoly.edu.ng` | `LecturerPass123!` | Mal. Ibrahim Mohammed (Senior Lecturer, Computer Science) |
| **Student** | `student@kadpoly.edu.ng` | `StudentPass123!` | Fatima Bello (HND I, Matric: `KPT/CST/23/45892`) |

> **Tip**: Use the **1-Click Test Role Switcher** at the top of the interface or on the sign-in screen to instantly switch between roles without retyping credentials.

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- Node.js (v18.0.0 or later)
- npm or bun

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd kadpoly-attendance-system

# Install dependencies
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
PORT=3000
JWT_SECRET=kadpoly_attendance_system_secure_jwt_secret_2026_salt_871923
NODE_ENV=development
```

### 4. Running the Development Server
```bash
npm run dev
```
The server will initialize the SQLite database (`data/kadpoly.sqlite`), execute migrations, seed initial departments and courses, and bind to `http://localhost:3000`.

### 5. Running Automated Tests
```bash
npm test
```
Executes the comprehensive 8-suite automated test verification covering database schema, hashing, registration, attendance formulas, duplicate prevention, correction approvals, audit logs, and PDF/Excel generation.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Express.js (ESM), TypeScript (`tsx`).
- **Database**: Relational SQLite via `sql.js` (WebAssembly) with persistent disk serialization (`data/kadpoly.sqlite`).
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing and HTTP-only cookies.
- **Document Engines**: `jspdf` & `jspdf-autotable` (PDF export) and `xlsx` (Excel export).

---

## 🛡️ Database Backup Guidance

The database is stored as a single binary SQLite file in `data/kadpoly.sqlite`.
To create an offline backup:
```bash
# Daily snapshot
cp data/kadpoly.sqlite backups/kadpoly_backup_$(date +%Y%m%d_%H%M%S).sqlite
```
For automated cloud backups:
1. Schedule a cron job to snapshot the `.sqlite` file during off-peak hours (e.g. 02:00 AM).
2. Sync the encrypted snapshot to an S3 or Google Cloud Storage bucket.

---

## 📦 Production Deployment

To build and run in production:
```bash
# 1. Build client assets
npm run build

# 2. Set production environment
export NODE_ENV=production

# 3. Start server
npm start
```
The Express server serves the optimized static assets from `dist/` and handles API requests on port 3000.
