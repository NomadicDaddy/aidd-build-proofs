import os

from flask import Flask, request


def create_app(test_config=None):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        # Session-signing key. No deployable default ships here: it is sourced
        # from the SECRET_KEY environment variable (or instance/config.py), and
        # startup fails fast below if it is missing or still the insecure "dev".
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        # store the database in the instance folder
        DATABASE=os.path.join(app.instance_path, "flaskr.sqlite"),
        # Harden the signed session cookie against interception and cross-site
        # replay. HttpOnly keeps it out of JavaScript; SameSite=Lax blocks it on
        # cross-site subrequests. SECURE (HTTPS-only) defaults False so the dev
        # server and the test suite work over plaintext HTTP; enable it in
        # production via SESSION_COOKIE_SECURE=True in instance/config.py.
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=False,
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # load the test config if passed in
        app.config.update(test_config)

    if app.config.get("TESTING"):
        # Tests don't provision a real secret; use a throwaway so session
        # signing works without weakening the production guard below.
        if not app.config.get("SECRET_KEY"):
            app.config["SECRET_KEY"] = "test"
    elif not app.config.get("SECRET_KEY") or app.config["SECRET_KEY"] == "dev":
        # Refuse to start with a forgeable session key in a real deployment.
        raise RuntimeError(
            "SECRET_KEY is unset or set to the insecure default 'dev'. "
            "Provide a strong, random SECRET_KEY via the SECRET_KEY environment "
            "variable or instance/config.py before starting flaskr."
        )

    # ensure the instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)

    # register the database commands
    from . import db

    db.init_app(app)

    # enable CSRF protection on state-changing requests
    from . import csrf

    csrf.init_app(app)

    # enable rate limiting / brute-force protection on the auth endpoints
    from . import ratelimit

    ratelimit.init_app(app)

    # apply the blueprints to the app
    from . import auth, blog

    app.register_blueprint(auth.bp)
    app.register_blueprint(blog.bp)

    # set hardening headers on every response (clickjacking, MIME sniffing,
    # referrer leakage). CSP restricts every resource to same-origin.
    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Content-Security-Policy", "default-src 'self'"
        )
        # HSTS is only meaningful over HTTPS; gating on a secure request keeps
        # it off the plaintext dev server and test client.
        if request.is_secure:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    # make url_for('index') == url_for('blog.index')
    # in another app, you might define a separate main index here with
    # app.route, while giving the blog blueprint a url_prefix, but for
    # the tutorial the blog will be the main index
    app.add_url_rule("/", endpoint="index")

    return app
