import os
import tempfile

import pytest
from flaskr import create_app
from flaskr.db import get_db, init_db

# read in SQL for populating test data
with open(os.path.join(os.path.dirname(__file__), "data.sql"), "rb") as f:
    _data_sql = f.read().decode("utf8")


@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    # create the app with common test config
    app = create_app({"TESTING": True, "DATABASE": db_path})

    # create the database and load test data
    with app.app_context():
        init_db()
        get_db().executescript(_data_sql)

    yield app

    # close and remove the temporary database
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """A test runner for the app's Click commands."""
    return app.test_cli_runner()


@pytest.fixture
def csrf_app():
    """An app instance with CSRF protection actively enforced.

    CSRF is disabled by default under TESTING so the ordinary tests can POST
    without a token; this fixture opts back in (CSRF_ENABLED=True) to exercise
    the protection itself.
    """
    db_fd, db_path = tempfile.mkstemp()
    app = create_app({"TESTING": True, "DATABASE": db_path, "CSRF_ENABLED": True})

    with app.app_context():
        init_db()
        get_db().executescript(_data_sql)

    yield app

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def csrf_client(csrf_app):
    """A test client for the CSRF-enforced app."""
    return csrf_app.test_client()


@pytest.fixture
def ratelimit_app():
    """An app instance with auth rate limiting actively enforced.

    Rate limiting is disabled by default under TESTING so ordinary tests are
    never throttled; this fixture opts back in (RATELIMIT_ENABLED=True) with a
    small threshold to exercise the protection itself. CSRF stays off (TESTING),
    so the throttling tests can POST without a token.
    """
    db_fd, db_path = tempfile.mkstemp()
    app = create_app(
        {
            "TESTING": True,
            "DATABASE": db_path,
            "RATELIMIT_ENABLED": True,
            "RATELIMIT_MAX_ATTEMPTS": 3,
            "RATELIMIT_WINDOW_SECONDS": 60,
        }
    )

    with app.app_context():
        init_db()
        get_db().executescript(_data_sql)

    yield app

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def ratelimit_client(ratelimit_app):
    """A test client for the rate-limited app."""
    return ratelimit_app.test_client()


class AuthActions:
    def __init__(self, client):
        self._client = client

    def login(self, username="test", password="test"):
        return self._client.post(
            "/auth/login", data={"username": username, "password": password}
        )

    def logout(self):
        return self._client.get("/auth/logout")


@pytest.fixture
def auth(client):
    return AuthActions(client)
