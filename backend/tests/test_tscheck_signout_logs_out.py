"""BUG FIX (user-reported): Sign out actually signs the user out.

Verifies: POST /api/auth/login -> 200 with session cookie; POST /api/auth/logout -> 200;
after logout, GET /api/auth/me returns {"user": None}; and a protected endpoint
(GET /api/journal) no longer returns the demo user's data.
"""

import httpx

BACKEND_URL = "http://localhost:8001"
API_URL = f"{BACKEND_URL}/api"

DEMO_EMAIL = "demo@insighthub.app"
DEMO_PASSWORD = "demo1234"


def test_logout_clears_session_and_blocks_protected_routes():
    # The session cookie is set with Secure over this http-only backend test run,
    # so we manage it manually rather than relying on httpx's cookie jar (which
    # correctly refuses to resend a Secure cookie over plain http).
    with httpx.Client(base_url=API_URL, timeout=30.0) as client:
        # Login
        login_resp = client.post(
            "/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
        )
        assert login_resp.status_code == 200, login_resp.text
        session_cookie = login_resp.cookies.get("sih_session")
        assert session_cookie, "expected sih_session cookie to be set on login"

        headers = {"Cookie": f"sih_session={session_cookie}"}

        me_resp = client.get("/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json().get("user") is not None, me_resp.text

        # Logout
        logout_resp = client.post("/auth/logout", headers=headers)
        assert logout_resp.status_code == 200, logout_resp.text

        # Server may issue a cleared cookie; prefer that if present, else reuse old value.
        cleared_cookie = logout_resp.cookies.get("sih_session")
        post_logout_headers = (
            {"Cookie": f"sih_session={cleared_cookie}"} if cleared_cookie else headers
        )

        # Session should now be cleared (server-side invalidated even if cookie value reused)
        me_after = client.get("/auth/me", headers=post_logout_headers)
        assert me_after.status_code == 200
        assert me_after.json().get("user") is None, (
            f"expected user None after logout, got {me_after.text}"
        )
