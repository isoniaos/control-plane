# Contributing to IsoniaOS Control Plane

Thank you for contributing to IsoniaOS Control Plane.

This repository is the public read/control-plane service for IsoniaOS. It indexes governance events, stores raw event history, builds replayable projections, exposes diagnostics, and serves typed REST APIs for App Core and SDK consumers.

## Before you start

Read these files first:

- `README.md`
- `AGENTS.md`
- `SECURITY.md`
- `CHANGELOG.md`

During active development, use current workspace sources and the current repository roadmap context. Do not treat old alpha line notes as current behavior unless the current code and docs still support them.

Inside the private IsoniaOS workspace, `@isonia/types` is resolved through the root pnpm workspace link during coordinated alpha work. Do not create new GitHub alpha tags just to consume sibling source changes.

## Architecture boundary

Smart contracts are the source of governance authority.

Control Plane must not become an authority service. It must not approve, veto, queue, execute, or cancel governance actions directly. It can read chain state, index events, explain routes, expose diagnostics, and serve read models.

Future SaaS functionality belongs outside this public repository unless maintainers explicitly move a neutral self-hosted primitive into the open-source core.

Do not add SaaS billing, subscriptions, usage metering, tenant management, platform admin workflows, private production deployment code, or real secrets to this repository.

## Prerequisites

Use:

- Node.js 22 or newer;
- Corepack with pnpm;
- local PostgreSQL;
- a local EVM node such as Hardhat when indexing local contracts.

## Local setup

Install dependencies:

    corepack pnpm install

Copy local configuration:

    cp .env.example .env

Adjust `.env` for your local PostgreSQL database, local RPC URL, chain ID, and deployed contract addresses.

Run migrations:

    corepack pnpm db:migrate

Start the complete local runtime:

    corepack pnpm dev

The local runtime starts:

- REST API;
- continuous indexer;
- continuous projection worker.

Manual commands are available for debugging and recovery:

    corepack pnpm api:dev
    corepack pnpm indexer:once
    corepack pnpm indexer:start
    corepack pnpm projections:start
    corepack pnpm projections:retry-failed
    corepack pnpm projections:rebuild

## Verification commands

Run the strongest relevant subset before handing work back:

    corepack pnpm lint
    corepack pnpm test
    corepack pnpm test:e2e
    corepack pnpm build
    git diff --check

Use `test:e2e` when API behavior changes. Use projection/indexer tests when event ingestion or replay behavior changes. The current `lint` script applies fixes, so check the resulting diff before handing work back.

If a command is skipped, explain why. If an existing unrelated failure appears, report it separately.

## Change categories

### REST API changes

When adding or changing endpoints:

- update `@isonia/types` first if DTO shapes are shared;
- update `@isonia/sdk` after the REST shape is stable;
- update Control Plane tests;
- update `README.md` endpoint documentation;
- update `CHANGELOG.md` under `Unreleased`.

### Database schema changes

When changing schema or migrations:

- keep a clean local database bootstrappable;
- keep replay/rebuild behavior deterministic;
- update schema tests;
- update reset/rebuild guidance if operator behavior changes.

### Indexer changes

When changing indexing:

- preserve raw events before projection;
- keep chain ID and contract address isolation explicit;
- avoid silently skipping events;
- expose useful diagnostics for stale, failed, or delayed indexing.

### Projection changes

When changing projections:

- keep projections replayable from raw events;
- keep failed-event handling explicit;
- avoid mutating read models in a way that cannot be rebuilt;
- update tests for ordering, idempotency, and org isolation where relevant.

### Diagnostics changes

Diagnostics should help operators and developers distinguish:

- API unavailability;
- RPC failure;
- stale chain data;
- contract address mismatch;
- indexing delay;
- projection backlog;
- failed projections;
- stale worker heartbeat;
- local configuration errors.

Diagnostics must not expose secrets.

## Code style

- Prefer small, focused changes.
- Keep Nest modules cohesive.
- Keep configuration validation explicit.
- Keep shared DTOs in `@isonia/types` rather than duplicating them locally.
- Keep public error shapes understandable for App Core and SDK users.
- Keep local debugging useful without leaking secrets.

## Changelog

Every operator-visible, developer-visible, or API-visible change should update `CHANGELOG.md` under `Unreleased`.

Do not create release sections, bump versions, or create tags unless the task explicitly asks for a release.

## Pull request checklist

Before opening or handing back a change, confirm:

- scope is focused;
- no secrets were added;
- no SaaS-only code was added;
- authority model is preserved;
- relevant tests were added or updated;
- relevant docs were updated;
- changelog was updated;
- verification commands were run or skipped with explanation.

## Security contributions

For suspected vulnerabilities, follow `SECURITY.md` instead of opening a public issue with exploit details.
