import re

import pytest
from flask import g, session
from flaskr.db import get_db


def _csrf_token(client, path):
    """Fetch a page and return the CSRF token its form renders."""
    match = re.search(rb'name="csrf_token" value="([^"]+)"', client.get(path).data)
    assert match is not None, f"no CSRF token rendered on {path}"
    return match.group(1).decode()


def test_register(client, app):
    # test that viewing the page renders without template errors
    assert client.get("/auth/register").status_code == 200

    # test that successful registration redirects to the login page
    response = client.post("/auth/register", data={"username": "a", "password": "a"})
    assert response.headers["Location"] == "/auth/login"

    # test that the user was inserted into the database
    with app.app_context():
        assert (
            get_db().execute("SELECT * FROM user WHERE username = 'a'").fetchone()
            is not None
        )


@pytest.mark.parametrize(
    ("username", "password", "message"),
    (
        ("", "", b"Username is required."),
        ("a", "", b"Password is required."),
        ("test", "test", b"already registered"),
    ),
)
def test_register_validate_input(client, username, password, message):
    response = client.post(
        "/auth/register", data={"username": username, "password": password}
    )
    assert message in response.data


def test_login(client, auth):
    # test that viewing the page renders without template errors
    assert client.get("/auth/login").status_code == 200

    # test that successful login redirects to the index page
    response = auth.login()
    assert response.headers["Location"] == "/"

    # login request set the user_id in the session
    # check that the user is loaded from the session
    with client:
        client.get("/")
        assert session["user_id"] == 1
        assert g.user["username"] == "test"


@pytest.mark.parametrize(
    ("username", "password", "message"),
    (("a", "test", b"Incorrect username."), ("test", "a", b"Incorrect password.")),
)
def test_login_validate_input(auth, username, password, message):
    response = auth.login(username, password)
    assert message in response.data


def test_logout(client, auth):
    auth.login()

    with client:
        auth.logout()
        assert "user_id" not in session


def test_csrf_protects_auth_forms(csrf_client, csrf_app):
    # A POST without a CSRF token is rejected server-side and has no effect.
    response = csrf_client.post(
        "/auth/register", data={"username": "b", "password": "b"}
    )
    assert response.status_code == 400
    with csrf_app.app_context():
        assert (
            get_db().execute("SELECT * FROM user WHERE username = 'b'").fetchone()
            is None
        )

    # The register form renders a token; the same POST then succeeds.
    token = _csrf_token(csrf_client, "/auth/register")
    response = csrf_client.post(
        "/auth/register",
        data={"username": "b", "password": "b", "csrf_token": token},
    )
    assert response.headers["Location"] == "/auth/login"
    with csrf_app.app_context():
        assert (
            get_db().execute("SELECT * FROM user WHERE username = 'b'").fetchone()
            is not None
        )

    # Login is protected too: a tokenless POST is rejected.
    assert (
        csrf_client.post(
            "/auth/login", data={"username": "b", "password": "b"}
        ).status_code
        == 400
    )


def test_csrf_leaves_get_requests_unaffected(csrf_client):
    # GET requests never require a token.
    assert csrf_client.get("/auth/register").status_code == 200
    assert csrf_client.get("/auth/login").status_code == 200


def test_rate_limit_blocks_login_brute_force(ratelimit_client):
    # The fixture caps attempts at 3 per window. The first three wrong-password
    # POSTs are processed normally (200, re-rendered login with the error)...
    for _ in range(3):
        response = ratelimit_client.post(
            "/auth/login", data={"username": "test", "password": "wrong"}
        )
        assert response.status_code == 200
        assert b"Incorrect password." in response.data

    # ...and the fourth is throttled with 429 before reaching the view.
    response = ratelimit_client.post(
        "/auth/login", data={"username": "test", "password": "wrong"}
    )
    assert response.status_code == 429


def test_rate_limit_blocks_register_flood(ratelimit_client):
    # Automated account creation is throttled the same way. Each unique username
    # registers successfully (302 redirect to login) until the cap is hit.
    for i in range(3):
        response = ratelimit_client.post(
            "/auth/register", data={"username": f"user{i}", "password": "pw"}
        )
        assert response.status_code == 302

    response = ratelimit_client.post(
        "/auth/register", data={"username": "user3", "password": "pw"}
    )
    assert response.status_code == 429


def test_rate_limit_disabled_by_default_in_tests(client):
    # Ordinary test client (RATELIMIT_ENABLED unset under TESTING) is never
    # throttled, so legitimate single-attempt usage keeps working.
    for _ in range(10):
        response = client.post(
            "/auth/login", data={"username": "test", "password": "wrong"}
        )
        assert response.status_code == 200


def test_rate_limit_leaves_get_requests_unaffected(ratelimit_client):
    # Only POSTs are counted; repeated GETs never trip the limit.
    for _ in range(10):
        assert ratelimit_client.get("/auth/login").status_code == 200
        assert ratelimit_client.get("/auth/register").status_code == 200
