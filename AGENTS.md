# IsoniaOS Control Plane Agent Rules

Current active target: v0.6 alpha.

This repository is the public IsoniaOS Control Plane. It provides indexing, projection, diagnostics, and REST read APIs for IsoniaOS governance read models.

## Authority model

Smart contracts are the source of governance authority.

Control Plane is not a source of governance authority. It indexes chain events, stores raw events, builds replayable read models, exposes diagnostics, and serves typed REST APIs for App Core, SDK consumers, and self-hosted operators.

If Control Plane state disagrees with chain state, chain state wins. Do not add code paths that allow Control Plane to approve, veto, queue, execute, or cancel governance actions directly. Those actions belong to contracts and client-side transaction flows.

## Repository boundary

Allowed in this public repository:

- NestJS REST API for public read models;
- local and self-hosted configuration;
- PostgreSQL schema, migrations, reset, rebuild, and replay scripts;
- EVM event indexing using configured RPC and contract addresses;
- replayable projections from raw events;
- route explanation and diagnostics services;
- tests for configuration, database schema, diagnostics, indexing, projections, and read models;
- documentation needed for local development and self-hosted operation.

Do not add:

- SaaS billing, subscriptions, paid plans, usage metering, or Stripe code;
- tenant management or hosted-customer provisioning;
- platform admin UI or private support workflows;
- private production deployment manifests;
- secrets, API keys, mnemonic phrases, private keys, or real hosted database credentials;
- managed AI provider keys or private AI orchestration;
- production security, audit, or compliance claims that have not been explicitly approved.

Future SaaS or Cloud code belongs in a separate private repository unless the maintainer explicitly moves a neutral self-hosted primitive into the open-source core.

## Versioning and release rules

- Keep `package.json.version` as SemVer without a leading `v`.
- Git tags use the same version with a leading `v`, for example `v0.6.0-alpha.1`.
- Do not invent new versions.
- Do not create Git tags automatically.
- Do not update dependency refs without a release or compatibility task.
- Put current work under `CHANGELOG.md` `Unreleased`.
- Keep changelog links and compatibility references aligned with the repository name `isoniaos/control-plane`.

## Dependency boundaries

- Use `@isonia/types` for shared DTOs, enums, event names, setup structures, and diagnostics shapes.
- Do not duplicate shared DTOs locally when they belong in `@isonia/types`.
- Use pinned GitHub tags or immutable commit refs for shared Isonia dependencies unless a local workspace-source task explicitly says otherwise.
- Do not add React, UI, wallet-connection UI, App Core, SaaS, or SDK code to Control Plane.
- Do not add governance authority logic to `@isonia/sdk`; the SDK is only a typed client for this REST surface.

## Configuration and secrets

- `.env.example` may contain local placeholder values only.
- `.env` must remain ignored by git.
- Local examples may use local Postgres and Hardhat defaults.
- Never commit real private keys, mnemonic phrases, RPC provider tokens, API tokens, database URLs, or customer data.
- Mask or omit sensitive runtime values in diagnostics.
- Treat operator configuration as untrusted input and validate it at startup.

## Development rules

- Prefer small, reviewable changes.
- Keep API, indexer, projection, and database changes separated when practical.
- Add or update tests for behavior changes.
- Keep migrations/schema changes replayable from a clean local database.
- Keep projection behavior deterministic and rebuildable from raw events.
- Preserve raw events before projection.
- Distinguish RPC failure, indexing delay, projection delay, stale config, contract mismatch, and database failure in diagnostics.
- Do not hide local debugging errors behind generic messages where developer diagnostics need detail.

## v0.6 scope guardrails

v0.6 focuses on making the existing local governance console demo understandable and reproducible.

In scope for v0.6 Control Plane:

- stable local development behavior;
- diagnostics needed by App Core;
- projection/indexer visibility;
- typed REST endpoints required by App Core and SDK;
- clear error shapes for local debugging;
- documentation for local demo and self-hosting boundaries.

Out of scope for v0.6 Control Plane:

- production deployment architecture;
- SaaS billing or tenant management;
- Safe integration;
- delegation;
- token-weighted voting;
- AI assistant or AI arbitrator;
- multi-chain production indexing;
- hosted monitoring platform;
- arbitrary calldata builder;
- security audit claims.

## Required verification before handing work back

Run the strongest relevant subset for the task:

- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e` when API behavior changes
- `corepack pnpm build`
- `git diff --check`

If a command is not run, report why. If an existing unrelated failure is encountered, report it separately and do not hide it.

## Documentation rules

Update documentation when behavior changes:

- update `README.md` for setup, commands, endpoints, configuration, or authority model changes;
- update `SECURITY.md` for security posture changes;
- update `CONTRIBUTING.md` for workflow or verification changes;
- update `CHANGELOG.md` under `Unreleased` for every user-visible or operator-visible change;
- update `isoniaos/docs` when REST DTOs, lifecycle behavior, diagnostics shape, or v0.6 scope changes affect the wider project documentation.

## Pull request and commit hygiene

- Keep changes focused.
- Explain whether changes affect API contracts, DB schema, indexing, projections, diagnostics, or docs only.
- Mention any required shared package updates.
- Do not mix publication cleanup, feature work, and release tagging in one task unless explicitly instructed.
