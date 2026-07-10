Flaskr
======

The basic blog app built in the Flask `tutorial`_.

.. _tutorial: https://flask.palletsprojects.com/tutorial/


Features
--------

- **User registration** — username/password with duplicate rejection and werkzeug-hashed storage
- **User login/logout** — session-based authentication with session-fixation mitigation
- **Blog post listing** — all posts newest-first with author bylines
- **Post CRUD** — logged-in users can create; authors can edit (403 for non-authors) and delete
- **Flash messages** — validation error and status feedback on all forms
- **SQLite persistence** — application-factory pattern with per-request connection management
- **Security controls** (verified): parameterized SQL (no injection), Jinja2 autoescaping (no XSS),
  salted password hashing, session.clear() on login


Install
-------

**Be sure to use the same version of the code as the version of the docs
you're reading.** You probably want the latest tagged version, but the
default Git version is the main branch. ::

    # clone the repository
    $ git clone https://github.com/pallets/flask
    $ cd flask
    # checkout the correct version
    $ git tag  # shows the tagged versions
    $ git checkout latest-tag-found-above
    $ cd examples/tutorial

Create a virtualenv and activate it::

    $ python3 -m venv .venv
    $ . .venv/bin/activate

Or on Windows cmd::

    $ py -3 -m venv .venv
    $ .venv\Scripts\activate.bat

Install Flaskr::

    $ pip install -e .

For a reproducible install pinned to known-good versions, use the lockfile::

    $ pip install -r requirements.txt -e .

Or if you are using the main branch, install Flask from source before
installing Flaskr::

    $ pip install -e ../..
    $ pip install -e .


Run
---

.. code-block:: text

    $ flask --app flaskr init-db
    $ flask --app flaskr run --debug

Open http://127.0.0.1:5000 in a browser.


Test
----

::

    $ pip install '.[test]'
    $ pytest

For a reproducible test environment pinned to known-good versions, use the
development lockfile instead::

    $ pip install -r requirements-dev.txt -e .
    $ pytest

Run with coverage report::

    $ coverage run -m pytest
    $ coverage report
    $ coverage html  # open htmlcov/index.html in a browser


Lint and coverage gates
-----------------------

Lint (``ruff``) and coverage (``pytest-cov``) are pinned in the development
lockfile and configured in ``pyproject.toml``. Install them with the ``dev``
extra, then run the gates::

    $ pip install '.[dev]'           # or: pip install -r requirements-dev.txt -e .

    # lint — ruff check (rules E, F, W, I) over the app and tests
    $ ruff check flaskr tests

    # tests with branch coverage; fails under 90% (see [tool.coverage.report])
    $ pytest --cov

``ruff check --fix`` auto-fixes most lint violations (e.g. import ordering).
Branch coverage is enabled via ``[tool.coverage.run] branch = true`` so
``pytest --cov`` measures branches without extra flags. The same two commands
run in CI on every push and pull request (see
``.github/workflows/ci.yml``).


Dependency lockfile
-------------------

Dependencies are pinned for reproducible installs and a stable
vulnerability-scan surface:

- ``requirements.txt`` — the fully pinned transitive closure of the runtime
  dependency (``flask``).
- ``requirements-dev.txt`` — the runtime lockfile plus the pinned ``test``
  extra (``pytest`` and its transitive dependencies).

``pyproject.toml`` remains the source of truth for the *declared* top-level
dependencies; the lockfiles pin the exact *resolved* versions those
declarations expand to.

To update the pins after changing a dependency in ``pyproject.toml``:

.. code-block:: text

    # resolve the latest compatible versions into a clean virtualenv
    $ pip install -e '.[test]'
    # inspect the resolved versions
    $ pip freeze
    # copy the runtime versions into requirements.txt and the test-only
    # additions into requirements-dev.txt, keeping the == pins exact
    # (colorama stays behind its ; sys_platform == "win32" marker)

    # verify the lockfile installs and the suite is green
    $ pip install -r requirements-dev.txt -e .
    $ pytest
