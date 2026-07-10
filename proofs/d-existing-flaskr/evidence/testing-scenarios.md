# Testing Scenarios — Flaskr

Flaskr is the canonical Pallets Flask tutorial blog: a server-rendered, session-authenticated SQLite app built with the application-factory + blueprint pattern. There is no SPA and no role hierarchy — authorization is session-based login plus per-post author ownership, so scenarios exercise the register → login → post → edit → delete lifecycle and the ownership/guard boundaries around it rather than RBAC tiers.

> **App note:** This is a Python/Flask app, not a standard spernakit app, so there are no SYSOP/ADMIN/MANAGER/OPERATOR/VIEWER tiers — the only privilege distinctions are anonymous-vs-authenticated (`login_required`) and author-vs-non-author (403 on other users' posts). Scenarios drive the server-rendered pages (nav, flash messages, post list, forms) via the browser. State-changing forms currently have no CSRF protection and the session cookie uses the default `dev` signing key — both are tracked as backlog remediations, so scenarios describe intended user behavior, not the hardened target.

## Scenarios

1. `spernakit-tester flaskr: I want to register a brand-new account, get redirected to the log-in page, sign in with those credentials, and confirm the nav switches from Register/Log In to my username plus a Log Out link.`
2. `spernakit-tester flaskr: I want to verify that registering a username that already exists is rejected with the "User {username} is already registered." flash and leaves me on the register page instead of creating a duplicate account.`
3. `spernakit-tester flaskr: I want to test that logging in with a valid username but wrong password shows "Incorrect password." and that an unknown username shows "Incorrect username.", with neither attempt establishing a session.`
4. `spernakit-tester flaskr: I want to log in, click New to create a post with a title and body, and confirm it appears at the top of the index list with my username and today's date as the author byline.`
5. `spernakit-tester flaskr: I want to verify that submitting the create-post form with an empty title is rejected with the "Title is required." flash and no post is added to the index.`
6. `spernakit-tester flaskr: I want to open one of my own posts via its Edit action, change the title and body, click Save, and confirm the updated content is reflected on the index without creating a second post.`
7. `spernakit-tester flaskr: I want to delete one of my own posts from its edit page, confirm the "Are you sure?" browser prompt, and verify the post disappears from the index afterward.`
8. `spernakit-tester flaskr: I want to verify author isolation by logging in as a second user and confirming the first user's posts show no Edit action, and that navigating directly to that post's update URL is refused with a 403.`
9. `spernakit-tester flaskr: I want to confirm that while logged out the index shows no New button and that visiting /create or an update URL directly redirects me to the log-in page.`
10. `spernakit-tester flaskr: I want to register two separate authors, have each publish a post, and verify the index lists posts newest-first with the correct author byline on each, then log out and confirm both posts are still publicly visible while the create/edit actions vanish.`

---

## Post-Test Procedure

- Run the native `bug2feature` ingredient for flaskr
- delete the ingested bugs from bugs.json files (delete them if only placeholder or tests remain)
- Run the native `feature-review` ingredient for flaskr
- iterate through remediation features created, resolving all issues and ensuring fixes applied intelligently to template as applicable
- delete remediation features resolved
- create session report (include time taken for each step among details)
