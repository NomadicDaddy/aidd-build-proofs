import re

import pytest
from flaskr.db import get_db


def _csrf_token(client, path):
    """Fetch a page and return the CSRF token its form renders."""
    match = re.search(rb'name="csrf_token" value="([^"]+)"', client.get(path).data)
    assert match is not None, f"no CSRF token rendered on {path}"
    return match.group(1).decode()


def test_index(client, auth):
    response = client.get("/")
    assert b"Log In" in response.data
    assert b"Register" in response.data

    auth.login()
    response = client.get("/")
    assert b"test title" in response.data
    assert b"by test on 2018-01-01" in response.data
    assert b"test\nbody" in response.data
    assert b'href="/1/update"' in response.data


def test_index_pagination(client, app):
    """The index shows at most one page of posts and paginates the rest."""
    from flaskr.blog import POSTS_PER_PAGE

    # Seed enough posts to fill two pages (one post already exists from data.sql).
    extra = POSTS_PER_PAGE + 2
    with app.app_context():
        db = get_db()
        for i in range(extra):
            db.execute(
                "INSERT INTO post (title, body, author_id, created)"
                " VALUES (?, ?, 1, ?)",
                (f"page post {i}", "body", f"2020-01-{i + 1:02d} 00:00:00"),
            )
        db.commit()
        total = db.execute("SELECT COUNT(id) FROM post").fetchone()[0]

    # Page 1 (default, no query param) returns exactly POSTS_PER_PAGE posts
    # and a link to the next page.
    response = client.get("/")
    assert response.data.count(b'<article class="post">') == POSTS_PER_PAGE
    assert b'href="/?page=2"' in response.data
    assert b"page=0" not in response.data

    # Page 2 returns the remainder and a link back to page 1.
    response = client.get("/?page=2")
    remainder = total - POSTS_PER_PAGE
    assert response.data.count(b'<article class="post">') == remainder
    assert b'href="/?page=1"' in response.data


def test_index_ignores_invalid_page(client):
    """A missing or non-numeric page parameter falls back to page 1."""
    assert client.get("/?page=notanumber").status_code == 200
    assert client.get("/?page=0").status_code == 200
    assert client.get("/").status_code == 200


@pytest.mark.parametrize("path", ("/create", "/1/update", "/1/delete"))
def test_login_required(client, path):
    response = client.post(path)
    assert response.headers["Location"] == "/auth/login"


def test_author_required(app, client, auth):
    # change the post author to another user
    with app.app_context():
        db = get_db()
        db.execute("UPDATE post SET author_id = 2 WHERE id = 1")
        db.commit()

    auth.login()
    # current user can't modify other user's post
    assert client.post("/1/update").status_code == 403
    assert client.post("/1/delete").status_code == 403
    # current user doesn't see edit link
    assert b'href="/1/update"' not in client.get("/").data


@pytest.mark.parametrize("path", ("/2/update", "/2/delete"))
def test_exists_required(client, auth, path):
    auth.login()
    assert client.post(path).status_code == 404


def test_create(client, auth, app):
    auth.login()
    assert client.get("/create").status_code == 200
    client.post("/create", data={"title": "created", "body": ""})

    with app.app_context():
        db = get_db()
        count = db.execute("SELECT COUNT(id) FROM post").fetchone()[0]
        assert count == 2


def test_update(client, auth, app):
    auth.login()
    assert client.get("/1/update").status_code == 200
    client.post("/1/update", data={"title": "updated", "body": ""})

    with app.app_context():
        db = get_db()
        post = db.execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post["title"] == "updated"


@pytest.mark.parametrize("path", ("/create", "/1/update"))
def test_create_update_validate(client, auth, path):
    auth.login()
    response = client.post(path, data={"title": "", "body": ""})
    assert b"Title is required." in response.data


def test_delete(client, auth, app):
    auth.login()
    response = client.post("/1/delete")
    assert response.headers["Location"] == "/"

    with app.app_context():
        db = get_db()
        post = db.execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post is None


def test_csrf_protects_blog_mutations(csrf_client, csrf_app):
    # Log in through the CSRF-protected login form.
    token = _csrf_token(csrf_client, "/auth/login")
    csrf_client.post(
        "/auth/login",
        data={"username": "test", "password": "test", "csrf_token": token},
    )

    # Every mutating endpoint rejects a POST that omits the token.
    for path in ("/create", "/1/update", "/1/delete"):
        response = csrf_client.post(path, data={"title": "x", "body": ""})
        assert response.status_code == 400, f"{path} accepted a tokenless POST"

    # The seeded post is untouched by the rejected requests.
    with csrf_app.app_context():
        post = get_db().execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post is not None
        assert post["title"] == "test title"

    # With a valid token the update goes through.
    token = _csrf_token(csrf_client, "/1/update")
    csrf_client.post(
        "/1/update", data={"title": "updated", "body": "", "csrf_token": token}
    )
    with csrf_app.app_context():
        post = get_db().execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post["title"] == "updated"
