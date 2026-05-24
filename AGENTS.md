# IsoniaOS Control Plane Agent Rules

These rules apply to Codex and other AI agents working in `control-plane`.

When this repository is used inside the IsoniaOS workspace, read the workspace-level `../AGENTS.md` first, then return to this file for repository-specific instructions.

## Repository Purpose

`control-plane` is the IsoniaOS indexer, projector, explainer, diagnostics service, and REST read API.

It is not a source of governance authority. If Control Plane state disagrees with chain state, chain state wins.

Do not add code paths that allow Control Plane to approve, veto, queue, execute, cancel, or otherwise decide governance actions directly. Those actions belong to contracts and client-side transaction flows.

## Active Target

Current active target: v0.8 accountability and integration-preview wave.

Control Plane should support production-shaped read models for Public Governance Archive, Basic Accountability Dashboard, source disclosure, external evidence/context, deployment capabilities, and route/accountability explanation.

## Authority and Capability Model

Do not infer runtime behavior from package version strings.

Use explicit runtime metadata and deployed evidence, including:

```txt
ISONIA_PROTOCOL_PROFILE
ISONIA_DEPLOYMENT_CAPABILITIES_JSON
```

Runtime capability decisions should be based on profile/capability metadata, configured deployed addresses, ABI/event compatibility, and observable chain state.

Do not forward local build selectors as authority or capability sources.

## Repository Boundary

Allowed in this public repository:

- NestJS REST API for public read models;
- local and self-hosted configuration;
- PostgreSQL schema, migrations, reset, rebuild, and replay scripts;
- EVM event indexing using configured RPC and contract addresses;
- replayable projections from raw events;
- route explanation and diagnostics services;
- source disclosure and trust-boundary read models;
- deployment capability read models;
- tests for configuration, database schema, diagnostics, indexing, projections, and read models.

Do not add:

- DemoTarget, customer ABI, provider assumption, Sepolia lab fixture, or presentation-record hardcoding in core services;
- SaaS billing, subscriptions, paid plans, usage metering, or Stripe code;
- hosted-customer provisioning or private production manifests;
- secrets, API keys, mnemonic phrases, private keys, real hosted database credentials, or customer data;
- managed AI provider keys or private AI orchestration;
- production, audit, public beta, SaaS, legal, provider-completeness, or ISO launch-readiness claims.

Provider adapters may be added only when explicitly scoped. Provider data remains evidence/context unless a product spec explicitly models it as authority.

## Dependency Boundaries

- Use `@isonia/types` for shared DTOs, enums, event names, setup structures, source disclosure, accountability, capabilities, and diagnostics shapes.
- Do not duplicate shared DTOs locally when they belong in `@isonia/types`.
- Do not depend on `@isonia/sdk` unless a narrowly scoped shared helper is deliberately moved there and documented.
- Do not add React, UI, wallet-connection UI, App Core, or SaaS code to Control Plane.

## SQL Safety Rules

Raw SQL is acceptable when it is parameterized and reviewable.

Dynamic identifiers, table names, column names, sort fields, sort directions, and filter keys must be whitelisted before interpolation. User input must not be interpolated into SQL text.

Evaluate a type-safe query builder such as Kysely later if useful, but do not introduce ORM churn without an explicit task.

## Indexing and Projection Rules

- Preserve raw events before projection.
- Store `blockHash` with raw events.
- Keep projections deterministic, idempotent, transaction-safe, and replayable.
- Keep event identity duplicate-safe.
- Distinguish RPC failure, indexing delay, projection delay, stale config, contract mismatch, capability mismatch, and database failure in diagnostics.
- Do not silently fall back to the latest policy when a proposal references a missing policy version.

## Versioning and Documentation

- Keep `package.json.version` as SemVer without a leading `v`.
- Do not create Git tags automatically.
- Put current work under `CHANGELOG.md` `Unreleased`.
- Update README, security, contributing, or wider `docs` content when API contracts, DB schema, indexing behavior, diagnostics, capability metadata, or authority boundaries change.

## Verification

Run the strongest relevant subset for behavior changes:

- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm test:e2e` when API behavior changes
- `corepack pnpm build`
- `git diff --check`

For AGENTS-only changes, `git diff --check` is sufficient.
