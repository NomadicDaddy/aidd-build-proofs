"""In-memory rate limiting for brute-force-sensitive endpoints.

The authentication endpoints (``auth.login`` and ``auth.register``) are exposed
to credential brute-force and automated account creation. This module caps the
number of POST attempts allowed from a single client IP within a sliding time
window and returns HTTP 429 (Too Many Requests) once the cap is exceeded.

This is a dependency-free equivalent of Flask-Limiter for the small set of auth
endpoints, and follows the same conventions as :mod:`flaskr.csrf`: protection is
enabled by default in real deployments and disabled automatically under
``TESTING`` (override with the ``RATELIMIT_ENABLED`` config key). The counters
live in process memory keyed per app instance, which is sufficient for the
single-process Flask dev server; a multi-process deployment would back this with
a shared store (e.g. Redis).
"""

import threading
import time
from collections import defaultdict

from flask import abort, request

# Endpoints (blueprint.view names) guarded against brute force.
_PROTECTED_ENDPOINTS = {"auth.login", "auth.register"}


def _client_ip():
    """Best-effort client identifier for rate-limit bucketing."""
    return request.remote_addr or "unknown"


def init_app(app):
    """Enable POST rate limiting for the auth endpoints on ``app``."""
    # Enforced in real deployments; off under TESTING so the ordinary test
    # POSTs are never throttled. Tests that exercise throttling opt in by
    # passing RATELIMIT_ENABLED=True explicitly.
    app.config.setdefault("RATELIMIT_ENABLED", not app.testing)
    app.config.setdefault("RATELIMIT_MAX_ATTEMPTS", 5)
    app.config.setdefault("RATELIMIT_WINDOW_SECONDS", 60)

    # attempts[(endpoint, ip)] -> list of monotonic timestamps, per app instance
    # so isolated test apps never share counters.
    attempts = defaultdict(list)
    lock = threading.Lock()

    @app.before_request
    def enforce_rate_limit():
        if not app.config["RATELIMIT_ENABLED"]:
            return
        if request.method != "POST" or request.endpoint not in _PROTECTED_ENDPOINTS:
            return

        max_attempts = app.config["RATELIMIT_MAX_ATTEMPTS"]
        window = app.config["RATELIMIT_WINDOW_SECONDS"]
        now = time.monotonic()
        key = (request.endpoint, _client_ip())

        with lock:
            recent = [ts for ts in attempts[key] if now - ts < window]
            if len(recent) >= max_attempts:
                attempts[key] = recent
                abort(
                    429,
                    description=(
                        "Too many attempts. Please wait before trying again."
                    ),
                )
            recent.append(now)
            attempts[key] = recent
