# Auth-Gated App Testing Playbook (Self Insight Hub)

This app supports TWO sign-in methods:
1. **Email + password** (own auth) — demo account: `demo@insighthub.app` / `demo1234`
2. **Google sign-in via Emergent Auth** — no app-managed password

Sessions are httpOnly cookies named **`sih_session`** (path `/`, secure, samesite=none),
stored in the `sessions` collection as `{token, user_id, expires_at, created_at}`.
Users live in `users` with a custom string `id` (uuid4) — MongoDB's `_id` is never exposed.

## Step 1: Create a test user & session directly in Mongo
```bash
mongosh --eval "
use('app');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,                       // custom string id (NOT _id)
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  password_hash: '',                // google-style user: no password
  picture: '',
  created_at: new Date()
});
db.sessions.insertOne({
  token: sessionToken,
  user_id: userId,                  // must match users.id exactly
  expires_at: new Date(Date.now() + 30*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User id: ' + userId);
"
```

## Step 2: Test the backend with that cookie
```bash
TOKEN=<session token from step 1>
curl -s --cookie "sih_session=$TOKEN" http://localhost:8001/api/auth/me
curl -s --cookie "sih_session=$TOKEN" http://localhost:8001/api/journal
curl -s --cookie "sih_session=$TOKEN" http://localhost:8001/api/timeline
```
Signed out, `GET /api/auth/me` returns `200 {"user": null}` **by design** (not 401).
All other routes return `401` when unauthenticated.

## Step 3: Browser testing
Easiest path — the login page has a one-click demo button:
`[data-testid="demo-login-button"]`.

To inject a session cookie instead:
```javascript
await context.addCookies([{
  name: "sih_session",
  value: "YOUR_SESSION_TOKEN",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "None"
}]);
await page.goto("http://localhost:3000/");
```

## Google sign-in flow (cannot be automated end-to-end)
Clicking `[data-testid="google-signin-button"]` redirects to
`https://auth.emergentagent.com/?redirect=<origin>/`. Real Google credentials are
required, so **do not attempt to complete this flow in automated tests** — verify only
that the button exists and points at the right URL. The callback side is testable:
the app processes `#session_id=...` on any route via the AuthCallback screen, then
POSTs to `/api/auth/google/session`. Hitting that endpoint with a bogus session_id
must return `401`.

## Checklist
- [ ] `users` docs carry a custom `id` field; `_id` never appears in API responses
- [ ] `sessions.user_id` matches `users.id` exactly
- [ ] `/api/auth/me` returns the user with a valid cookie, `{"user": null}` without
- [ ] Protected routes 401 without the cookie
- [ ] Dashboard loads (no redirect to /login) with a valid cookie
- [ ] Email/password users can change name, email (needs current password) and password
- [ ] Google-only users (empty `password_hash`) can SET a password without supplying one

## Test identities
See `/app/memory/test_credentials.md`. No password is stored for Google accounts.
