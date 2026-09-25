"""Transactional email via Emergent's managed integration.

Recipients always come from server-side records and bodies from the server-side
templates below — no caller ever supplies a recipient, subject or HTML body.
"""

import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

# Self-load .env so standalone scripts (seed.py, one-off sends) inherit config too.
load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

# Emergent managed email proxy. This is a CONSTANT — never read it from
# os.environ, so it survives deployment.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Self Insight Hub")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
APP_URL = os.environ.get("APP_URL", "https://self-insight-hub-4.preview.emergentagent.com")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")  # G2 ask-back phrasing
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)   # host-looking text


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    """Structural G2 + G3 gate. If legitimate copy trips this, rewrite the copy —
    never weaken, wrap in try/except, or delete it."""
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    """Internal helper. `html` comes from a server-side template, never request input (G4)."""
    if not EMAIL_KEY:
        logger.error("send_email: EMERGENT_EMAIL_KEY is not set")
        raise HTTPException(status_code=503, detail="Email is not configured")
    _assert_safe_email(subject, html)  # G2-G3 gate — never skip
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error("Email send failed: %s %s", e.response.status_code, e.response.text)
        # The provider blocks addresses it believes cannot receive mail (e.g. a made-up
        # domain like the seeded demo account). Say so, rather than "something went wrong".
        if e.response.status_code == 422 and "undeliverable" in e.response.text.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{to} looks undeliverable, so no email was sent. "
                    "Change your account email in Settings to a real inbox and try again."
                ),
            )
        raise HTTPException(status_code=502, detail="Failed to send email")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Email send error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send email")


def reminder_html(*, name: str, prompt: str, streak: int) -> str:
    """Server-side template for the daily reflection nudge. All interpolation escaped."""
    safe_name = escape(name or "there")
    safe_prompt = escape(prompt)
    brand = escape(EMAIL_FROM_NAME)
    streak_line = (
        f"You're on a <strong>{streak}-day</strong> reflection streak — one honest paragraph keeps it alive."
        if streak > 0
        else "A single honest paragraph is enough to begin a new streak."
    )
    return (
        '<table role="presentation" width="100%" style="background:#FAF7F2;padding:24px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;'
        'border:1px solid #E8DEC8;border-radius:16px;font-family:Georgia,\'Times New Roman\',serif">'
        '<tr><td style="padding:28px 28px 8px">'
        f'<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;'
        f'color:#6B6257;font-family:Arial,sans-serif">{brand}</p>'
        f'<h1 style="margin:10px 0 0;font-size:22px;color:#1F1B16;font-weight:normal">'
        f'A moment for you, {safe_name}</h1>'
        '</td></tr>'
        '<tr><td style="padding:12px 28px">'
        '<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;'
        'color:#A65B32;font-family:Arial,sans-serif">Today\'s reflection question</p>'
        f'<p style="margin:0;font-size:19px;line-height:1.5;color:#1F1B16">{safe_prompt}</p>'
        '</td></tr>'
        '<tr><td style="padding:8px 28px 4px">'
        f'<p style="margin:0;font-size:14px;line-height:1.6;color:#6B6257;'
        f'font-family:Arial,sans-serif">{streak_line}</p>'
        '</td></tr>'
        '<tr><td style="padding:20px 28px 28px">'
        f'<a href="{APP_URL}/" style="display:inline-block;background:#A65B32;color:#ffffff;'
        'text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;'
        'font-family:Arial,sans-serif">Write today\'s reflection</a>'
        '</td></tr>'
        '<tr><td style="padding:0 28px 26px">'
        '<p style="margin:0;font-size:12px;line-height:1.6;color:#8A8078;font-family:Arial,sans-serif">'
        f'Sent by {brand} because you turned on daily reminders. You can change the time or switch '
        f'them off any time in Settings. We never ask for your password by email.</p>'
        '</td></tr>'
        '</table></td></tr></table>'
    )
