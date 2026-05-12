# SECURITY.md — RoomBooking Security Audit

## 1. Vulnerabilities Found & How Each Was Fixed

---

### AUTH-01 — JWT expiry was 7 days (too long)
**Risk:** A stolen token remained valid for a week, giving an attacker a large window.  
**Fix:** Changed `expiresIn` from `"7d"` to `"8h"` in `server/src/auth.js`.

---

### AUTH-02 — No session-expiry feedback to the user
**Risk:** After a token expired, API calls silently failed with 401 and the user saw confusing errors.  
**Fix:**
- Server now returns `{ code: "TOKEN_EXPIRED" }` on 401.
- `client/src/api/client.js` has a response interceptor that calls `expireSession()` when a 401 is received while a token is stored.
- `client/src/layout/SessionExpiredBanner.jsx` shows a dismissible amber banner with a "Log in" button.
- `client/src/state/auth.jsx` exposes `expireSession()` which clears localStorage and sets `sessionExpired: true`.

---

### AUTH-03 — password_hash exposed in login query result
**Risk:** The `password_hash` field was fetched from the DB and could accidentally be forwarded to the client.  
**Fix:** The login handler explicitly builds a `user` object with only `{ id, full_name, email, role }` before signing the JWT and returning the response. `password_hash` is never included in any API response.

---

### AUTH-04 — Registration flow stored no password; admin generated a temp password
**Risk:** The user had to receive a temporary password out-of-band (e.g. WhatsApp), which is insecure and error-prone.  
**Fix:**
- `RequestAccess` form now collects `password` + `confirm password`.
- The server hashes the password with bcrypt (cost 12) and stores it in `registration_requests.password_hash`.
- On approval, the stored hash is copied directly into `users.password_hash` — no temp password is ever generated or transmitted.
- The admin API never returns `password_hash` (the `SELECT` in `GET /api/admin/registration-requests` explicitly omits it).

---

### AUTH-05 — No rate limiting on login endpoint
**Risk:** Brute-force attacks could enumerate passwords without restriction.  
**Fix:** `express-rate-limit` applied to `POST /api/auth/login`: max 10 attempts per IP per 15 minutes.

---

### AUTH-06 — No rate limiting on request-access endpoint
**Risk:** Spam/abuse of the registration request endpoint.  
**Fix:** `express-rate-limit` applied to `POST /api/auth/request-access`: max 3 requests per IP per hour.

---

### CORS-01 — CORS allowed all origins (`origin: true`)
**Risk:** Any website could make credentialed cross-origin requests to the API.  
**Fix:** CORS now only allows:
- `https://bookingsolution.netlify.app`
- `http://localhost:5173`

All other origins receive a CORS error.

---

### HEADERS-01 — No security headers
**Risk:** Missing headers like `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.  
**Fix:** Added `helmet` middleware in `server/src/index.js`. Helmet sets all standard security headers automatically.

---

### ADMIN-01 — No user deletion capability
**Risk:** Admins had no way to remove compromised or departed user accounts.  
**Fix:** Added `DELETE /api/admin/users/:id` endpoint with the following guards:
- An admin cannot delete their own account.
- The seeded first admin (`isaac.benit@testsolutions.de`) cannot be deleted by anyone.
- Bookings are removed automatically via `ON DELETE CASCADE` on the FK.
- The frontend shows a confirmation dialog before sending the request.

---

### ADMIN-02 — Admin routes relied solely on middleware; no defence-in-depth
**Risk:** If middleware was accidentally removed or bypassed, admin actions would be unprotected.  
**Fix:** `requireAuth` + `requireAdmin` middleware is applied at the router mount point in `index.js` (`app.use("/api/admin", requireAuth, requireAdmin, adminRouter)`), ensuring every admin route is protected at the Express level before any handler runs.

---

### LOG-01 — Unreachable `console.log` after `return` in calendar route
**Risk:** Dead code; also would have logged booking data if the `return` were ever removed.  
**Fix:** Removed the `console.log("bookings", bookings)` line from `server/src/routes/calendar.js`.

---

### LOG-02 — Login error logged full DB error details
**Risk:** Internal DB error details (constraint names, query fragments) could leak to server logs and potentially to monitoring tools.  
**Fix:** Login error logging now only logs `{ code, message }` — not `detail` or `constraint`.

---

### DB-01 — `registration_requests` table had no `password_hash` column
**Risk:** The new registration flow could not store the user's chosen password.  
**Fix:** Added `password_hash TEXT NULL` column to the `CREATE TABLE` statement and an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration for existing databases.

---

### DB-02 — Missing indexes on `users.email` and `registration_requests.email`
**Risk:** Email lookups (login, request-status, conflict checks) performed full table scans.  
**Fix:** Added `idx_users_email` and `idx_registration_requests_email` indexes in `database.sql`.

---

### ROUTE-01 — Logo always redirected to `/register` regardless of auth state
**Risk:** Poor UX; logged-in users were sent to the registration page.  
**Fix:** Logo now links to `/rooms` when authenticated, `/` (homepage) when not.

---

### ROUTE-02 — No proper homepage; `/` redirected to `/register`
**Risk:** Poor first impression; no landing page for unauthenticated visitors.  
**Fix:** Created `client/src/pages/Home.jsx` with branding, tagline, CTA buttons, and room cards. Logged-in users are redirected to `/rooms` automatically.

---

## 2. Remaining Known Limitations

| # | Limitation | Notes |
|---|-----------|-------|
| L1 | JWT stored in `localStorage` | Vulnerable to XSS. An httpOnly cookie would be more secure but requires same-origin or CORS with credentials. Acceptable for this deployment model. |
| L2 | Rate limiting is in-memory | `express-rate-limit` resets on server restart and does not share state across multiple instances. Use `rate-limit-redis` for production multi-instance deployments. |
| L3 | No CSRF protection | Since credentials are not used (no cookies), CSRF is not a risk for the current architecture. If cookies are adopted, add `csurf` or `sameSite: strict`. |
| L4 | No email verification | Users can submit requests with any `@testsolutions.de` address they don't own. Mitigated by admin approval gate. |
| L5 | No password reset flow | Users who forget their password must contact an admin to delete and re-create their account. |
| L6 | Seeded admin password is in `database.sql` | The seed password `moviebenit@1` is visible in source control. Change it immediately after first deploy via a direct DB update. |

---

## 3. Recommendations for Future Improvements

1. **Refresh tokens** — Issue short-lived access tokens (15 min) + long-lived refresh tokens stored in httpOnly cookies to balance security and UX.
2. **Password reset via email** — Integrate an email provider (SendGrid, Resend) to send time-limited reset links.
3. **Audit log table** — Record admin actions (approve, reject, delete, role change) with timestamp and actor ID for accountability.
4. **Redis-backed rate limiting** — Replace in-memory rate limiting with `rate-limit-redis` for multi-instance resilience.
5. **Input length caps** — Add `maxLength` constraints on all text fields (name, reason, meeting name) both client-side and in DB schema.
6. **Content Security Policy tuning** — Helmet's default CSP may block inline styles from Tailwind in some configurations. Tune the CSP directives for your specific deployment.
7. **Dependency scanning** — Add `npm audit` to your CI pipeline and consider Dependabot or Snyk for automated vulnerability alerts.
8. **HTTPS enforcement** — Ensure Render enforces HTTPS and set `HSTS` max-age to at least 1 year once the domain is stable.
