import pytest
from flaskr import create_app


def test_config():
    """Test create_app without passing test config."""
    # A non-test app must be given a real SECRET_KEY (bare create_app() now
    # fails fast on the missing/default key — see test_secret_key_required).
    assert not create_app({"SECRET_KEY": "a-real-secret"}).testing
    assert create_app({"TESTING": True}).testing


def test_session_cookie_hardening():
    """The signed session cookie must ship with hardened flags."""
    app = create_app({"TESTING": True})
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"
    # SECURE defaults False so the dev server / tests work over plaintext HTTP,
    # but must be overridable to True for production HTTPS deployments.
    assert app.config["SESSION_COOKIE_SECURE"] is False
    secure_app = create_app({"TESTING": True, "SESSION_COOKIE_SECURE": True})
    assert secure_app.config["SESSION_COOKIE_SECURE"] is True


def test_security_headers_present(client):
    """Every response must carry the baseline hardening headers."""
    response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == "default-src 'self'"
    # HSTS must not be sent over the plaintext (non-secure) test request.
    assert "Strict-Transport-Security" not in response.headers


def test_secret_key_required():
    """create_app must reject an unset or default SECRET_KEY outside test mode."""
    with pytest.raises(RuntimeError):
        create_app({"SECRET_KEY": "dev"})
    with pytest.raises(RuntimeError):
        create_app({"SECRET_KEY": None})
