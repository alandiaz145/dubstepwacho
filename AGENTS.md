# Prototype Instructions

## Autonomous development continuity

- Treat GitHub `alandiaz145/dubstepwacho` on `main` as the durable source of truth. At the start of each development cycle, read this file, `ROADMAP.md`, and `SECURITY.md`, inspect the latest code and commits, and select the next independently authorized task.
- Work in cycles: inspect dependencies, implement a bounded change, add/update tests, run the relevant suite and production build, verify the result, commit with a descriptive message to an isolated branch, open or update a descriptive pull request targeting `main`, update the roadmap, and continue with the next safe task. Never push technical changes directly to `main`, merge without human review, or deploy sensitive changes automatically. Do not stop merely because one stage is complete.
- Prioritize account security and recovery; then private uploads, moderation and playback; then EPs, artist profiles and community; then mobile performance and accessibility; then integration QA. Preserve Alan's approved visual identity, artwork and promotional copy; Alan owns final artistic decisions.
- Ordinary technical changes, tests, refactoring, documentation and GitHub commits are authorized. Do not enable public registration, user uploads, paid services, public distribution of unpublished works, production-writing scheduled agents, or new privileged integrations without separate authorization and verified safeguards.
- When blocked by credentials, Cloudflare configuration, costs, commercial decisions or physical-device testing, record the exact blocker and a safe next step in `ROADMAP.md`, then work on another independent task. Never bypass permissions or invent successful production verification.
- Keep `ROADMAP.md` current with completed functionality, bugs, blocked tasks, test results and the next recommended action. Update `SECURITY.md` for security-relevant decisions. Keep credential values out of repositories, logs and replies.
- Future scheduled coding agents are design-only until Alan explicitly authorizes their permissions, spending and production effects. See `AUTOMATION.md`.

For account, D1, R2 or streaming changes, run `npm run test:runtime` on Node.js 24 as well as the existing suites. This uses isolated local Miniflare/workerd bindings and synthetic data, never production credentials or live email. Keep the test-only route adapter under `tests/runtime/` out of deployment bundles.

For frontend playback or dialog changes, also run `npm run test:browser`. It uses playwright-core with installed Chromium (`DW_CHROMIUM_PATH` overrides `/usr/bin/chromium`), a local Vite server, intercepted APIs and synthetic WAV audio. It is not an iPhone Safari or real MP3 compatibility check.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions (2026-11-13)

- Community for Latin American Dubstep/Bass artists. Preserve the lime-on-black visual identity and mobile responsiveness.
- Recurring **DubstepWacho Community EP Series**, beginning with Vol. 1: aspirational producer invitation, later permissioned submissions, selection, credits, artist profiles, volume archive, dates and explicit distribution rights. Do not imply intake is open until the backend is ready.
- Music player should act like continuous, ad-free radio when authorized audio is published: skip visual demos, advance automatically and offer a queue. Never fake playback. Verify scrubbing on iPhone Safari before release.
- Future concepts: moderated per-track feedback, regional artist map, official WhatsApp community, donations with transparent hosting costs, producer marketplace with clear licenses and commissions.
- Keep registration and uploads off until abuse prevention, email verification, malware scanning, moderation and public streaming access are tested. Do not activate paid services without authorization.
- Registration client and server have Turnstile scaffolding. The public sitekey comes from `/api/auth/config`; registration is disabled unless the auth flag and both keys exist. Do not set those flags until email ownership and account lifecycle are implemented.
- Public music catalog and streaming are read-only and must always enforce both `status='published'` and `scan_status='clean'` before fetching private R2 objects. Keep HTTP byte-range support for iPhone seeking. Never list or serve quarantine/pending/approved-only tracks.
- New registration now requires email ownership verification (migration 0003), and account recovery requires migration 0004. Neither migration has been applied to production. Delivery adapter uses Resend only if secrets are explicitly configured; no paid provider is active. Keep AUTH_ENABLED false until both migrations, real email and bot challenge are end-to-end tested.
- The administration UI must use authenticated `/api/admin/*` endpoints only; never resurrect the earlier local, session-only approve/reject simulation. A published track still requires `scan_status='clean'` and human approval, with withdrawal logging.
- EP archive uses migration 0005 (not yet applied). Keep draft, open, and selecting EPs private; public read API must require `ep_volumes.status='published'` and tracks `published+clean`. No user submissions or actual dates should be advertised before the rules are approved.
