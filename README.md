# RPT Field Collection Monitoring — DEMO

Mobile web-based **Real Property Tax Information and Field Collection Monitoring System** for a Municipal Treasurer's Office.

> **This is a demonstration.** All records are fictional sample data stored only in your web browser. There is no database or server. Do not enter real taxpayer information.

## Running the demo

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # open the link shown (usually http://localhost:5173)
```

Other commands: `npm run build` (production files in `dist/`), `npm run preview`, `npm test`, `npm run lint`.

The built `dist/` folder can be placed on any static web host. URLs use `#/…` so no server configuration is needed.

## Demo accounts

Password for all accounts: **`Demo@2026`** (also shown on the login screen).

| Username | Name | Role |
|---|---|---|
| `admin` | Ramon D. Villanueva | System Administrator |
| `treasurer` | Elena C. Ramos | Treasury Personnel (Municipal Treasurer) |
| `treasury.staff` | Josefina A. Cruz | Treasury Personnel |
| `collector1` … `collector4` | Reyes, Garcia, Mendoza, Fernandez | Revenue Collectors (2 barangays each) |

To start over, log in as `admin` → **Demo Settings** → **Reset demo data**.

## Suggested walkthrough

1. **Collector (use a phone or a narrow browser window):** log in as `collector1` → *My Assignments* → *Log visit* → choose *Partial payment*, enter an amount, attach location → *Save visit*. Enter the same collection again to see the duplicate warning.
2. **Treasury:** log in as `treasurer` → *Field Record Review* → verify the collector's record (enter an OR No.). Open the property and *Record payment* — try reusing the same OR No. (blocked). Open *Reports* → download PDF / Excel.
3. **Administrator:** log in as `admin` → *User Accounts* (add, reset password, deactivate) → *Activity Log* shows everything done above.

## Modules

| # | Module | Where |
|---|---|---|
| 01 | User Login & Access Control | Login, Change Password, User Accounts, Activity Log |
| 02 | Taxpayer & Property Information | Properties, Taxpayers |
| 03 | RPT Collection Monitoring | Collection Monitoring, Field Record Review |
| 04 | Field Collection Monitoring | My Assignments, Record a visit, My Visits, Field Visits, Collector Assignments |
| 05 | Dashboard & Reports | Dashboard, Reports (Print / PDF / Excel) |

**Treasury payment vs. field record:** a *Treasury payment* has an Official Receipt (OR) No. and reduces the balance. A *field record* is entered by a collector, is clearly labelled *not an Official Receipt*, and counts only after Treasury verifies it.

## Security measures in this demo

- Passwords hashed with PBKDF2-SHA256 and a random salt (Web Crypto); never stored or shown in plain text.
- Generic login error; account locked for 5 minutes after 5 failed attempts.
- Automatic logout after 15 minutes of inactivity (with a 60-second warning). Session ends when the tab closes.
- Role-based permissions (`src/lib/permissions.js`) enforced **inside every service function**, not only by hiding buttons.
- Collectors see only properties in their assigned area; contact numbers masked; GPS visible only to Treasury/Admin.
- GPS is optional, taken once with an explicit consent dialog (RA 10173, Data Privacy Act).
- All inputs validated (`src/lib/validation.js`); duplicate OR numbers blocked; possible duplicate collections flagged.
- Spreadsheet exports neutralise formula injection; every export is stamped with the demo notice and logged.
- Content-Security-Policy in the production build; no third-party scripts, fonts or trackers.
- Saved data is checked on load and safely reset if damaged.

## Required before production (not part of this demo)

- Central database and server API — replace the bodies of `src/services/*.js` with HTTP calls; screens do not change.
- Server-side authentication (Argon2/bcrypt), HTTPS only, secure HTTP-only session cookies, rate limiting.
- Server-enforced permissions and audit log that cannot be altered.
- HTTP security headers, including `Content-Security-Policy` with `frame-ancestors 'none'` (cannot be set from HTML).
- Integration with official Assessor and Treasury records; penalties/discounts per the Local Government Code.
- Encrypted backups, Data Protection Officer review, privacy notice, and a security/penetration test.

## Project structure

```
src/
  components/ui/       shadcn/ui components
  components/common/   shared building blocks (tables, badges, forms, dialogs)
  components/layout/   app shell, navigation, demo banner, idle logout
  features/            one folder per screen group
  services/            business rules + permission checks (the future API boundary)
  data/                demo store (localStorage), schemas, sample-data generator
  lib/                 permissions, validation, tax calculations, formatting
  tests/               automated tests (Vitest)
```
