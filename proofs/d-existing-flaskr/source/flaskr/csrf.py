"""Synchronizer-token CSRF protection.

State-changing requests (POST/PUT/PATCH/DELETE) must carry a token that
matches the per-session token stored in the signed session cookie. The token
is exposed to templates as the ``csrf_token()`` Jinja global so every form can
render a hidden field. Validation happens server-side in a ``before_request``
hook, so a forged cross-site POST that lacks the token is rejected before it
reaches any view.

This is a dependency-free equivalent of Flask-WTF's ``CSRFProtect`` and follows
the same conventions: protection is enabled by default in real deployments and
disabled automatically under ``TESTING`` (override with the ``CSRF_ENABLED``
config key).
"""

import hmac
import secrets

from flask import abort, request, session

_SESSION_KEY = "_csrf_token"
_FORM_FIELD = "csrf_token"
_HEADER_NAME = "X-CSRFToken"
_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def generate_csrf():
    """Return the current session's CSRF token, creating one on first use."""
    if _SESSION_KEY not in session:
        session[_SESSION_KEY] = secrets.token_urlsafe(32)
    return session[_SESSION_KEY]


def validate_csrf():
    """Abort with 400 if the request lacks a valid CSRF token."""
    expected = session.get(_SESSION_KEY)
    submitted = request.form.get(_FORM_FIELD) or request.headers.get(_HEADER_NAME, "")
    if not expected or not submitted or not hmac.compare_digest(expected, submitted):
        abort(400, description="The CSRF token is missing or invalid.")


def init_app(app):
    """Enable CSRF protection for state-changing requests on ``app``."""
    # Enforced in real deployments; off under TESTING so existing test POSTs
    # (which carry no token) keep working. Tests that exercise CSRF opt in by
    # passing CSRF_ENABLED=True explicitly.
    app.config.setdefault("CSRF_ENABLED", not app.testing)

    # Make the token available to every template as {{ csrf_token() }}.
    app.jinja_env.globals["csrf_token"] = generate_csrf

    @app.before_request
    def csrf_protect():
        if app.config["CSRF_ENABLED"] and request.method in _PROTECTED_METHODS:
            validate_csrf()
