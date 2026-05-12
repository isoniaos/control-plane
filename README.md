# IsoniaOS Control Plane

Public indexing, projection, diagnostics, and REST read API for IsoniaOS governance read models.

## Status

Active development target: v0.6 alpha preparation.

Current package version remains `0.5.0-alpha.3`, the v0.5 compatibility tag. v0.6 work starts from this baseline without changing the production authority model.

This repository is part of the public IsoniaOS open-source core. It is intended to be self-hostable and inspectable by DAO operators, developers, design partners, and future integrators.

## Authority Model

Control Plane is not a source of governance authority.

Smart contracts remain authoritative. Control Plane indexes chain events, stores raw events durably, builds replayable read models, explains proposal routes from indexed policy snapshots, exposes diagnostics, and serves typed REST APIs for App Core and SDK consumers.

If Control Plane state disagrees with chain state, chain state wins.

The public App Core may display transaction controls, but those controls are UI hints. Contract authorization and execution rules remain final.

## Repository Boundary

In scope for this public repository:

- poll local or configured EVM logs with `getLogs`;
- store raw events durably before projection;
- build replayable read models;
- expose `/v1` REST endpoints using shared `@isonia/types` DTOs;
- explain proposal routes from indexed policy snapshots;
- expose diagnostics for API, chain, indexer, projection, and runtime heartbeat state;
- support local development and self-hosted operation.

Out of scope for this public repository:

- SaaS billing;
- subscription plans;
- tenant management;
- hosted-customer provisioning;
- platform admin workflows;
- private production deployment manifests;
- real secrets or hosted credentials;
- managed AI provider keys or private AI orchestration;
- production audit or security-hardening claims.

Future SaaS or Cloud functionality should live in a separate private repository unless a neutral self-hosted primitive is explicitly moved into the open-source core.

## Security Status

This is alpha software. It has not been independently audited and should not be used to secure production DAO treasuries, protocol upgrades, or legally binding governance processes without additional review.

See `SECURITY.md` for vulnerability reporting, secret-handling rules, and disclosure expectations.

## Scope

- poll local EVM logs with `getLogs`;
- store raw events durably before projection;
- build replayable read models;
- expose `/v1` REST endpoints using shared `@isonia/types` DTOs;
- explain proposal routes from indexed policy snapshots.

## Local Postgres

Default local database settings:

```txt
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=control-plane
PG_USER=postgres
PG_PASSWORD=secret
```

`DATABASE_URL` can be used instead of the individual `PG_*` variables.
Copy `.env.example` to `.env` for the full local configuration surface. The `.env` file is ignored by git.

Application and worker scripts preload `dotenv/config` before bootstrapping Nest services, so local commands, one-shot indexer runs, projection workers, and Jest tests read the same `.env` values as `src/main.ts`.

## Commands

```txt
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev
```

`pnpm dev` starts the complete local Control Plane runtime for the current v0.6 baseline inherited from the v0.5 compatibility set:

- REST API;
- continuous indexer;
- continuous projection worker.

Manual commands remain available for debugging, CI, and recovery:

```txt
corepack pnpm api:dev
corepack pnpm indexer:once
corepack pnpm indexer:start
corepack pnpm projections:start
corepack pnpm projections:retry-failed
corepack pnpm projections:rebuild
```

`projections:retry-failed` clears failed projection markers for the configured `CHAIN_ID` and immediately attempts to process the requeued rows. Normal projection workers skip failed rows until this manual retry path or a full `projections:rebuild` is run.

## Verification

Useful local checks:

```txt
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
git diff --check
```

Use `test:e2e` when REST behavior changes.

## Shared Package Dependency

This package consumes shared DTOs and enums through the pinned v0.7 compatibility tag:

```json
{
  "dependencies": {
    "@isonia/types": "github:isoniaos/types#v0.7.0-alpha.1"
  }
}
```

Do not duplicate shared DTOs locally. Add shared domain types to `@isonia/types` first.

## v0.7 Activation Capabilities

Control Plane exposes activation capability metadata for v0.7 typed contract batch activation:

```txt
GET /v1/capabilities
```

The response reports serial activation as the fallback path. Contract-level typed batch activation is reported as supported only when `EVM_CONTRACTS_VERSION` is configured for a v0.7-compatible contract deployment, currently `v0.7.0-alpha.1`. EIP-5792 remains optional/prototype wallet behavior and is not reported as the primary activation mode.

Typed batch calls still emit granular domain events, so read-model recovery remains event-driven and equivalent to serial setup where the underlying contracts emit the existing per-item events.

## Indexer Configuration

```txt
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
GOV_CORE_ADDRESS=0x...
GOV_PROPOSALS_ADDRESS=0x...
EVM_CONTRACTS_VERSION=v0.7.0-alpha.1
START_BLOCK=0
CONFIRMATIONS=0
BLOCK_RANGE_SIZE=1000
POLL_INTERVAL_MS=5000
API_PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_CREDENTIALS=false
```

Leave contract address variables blank until local contracts are deployed. The zero address is rejected so placeholder config cannot be mistaken for an indexed protocol deployment.

REST API is exposed under `/v1`.

Diagnostics for operator support are available at:

```txt
GET /v1/diagnostics
GET /v1/diagnostics/indexer
GET /v1/capabilities
```

The diagnostics response includes API version, configured chain and contract addresses, latest observed and safe blocks when RPC is available, indexer cursors, raw event counts, projection backlog/failures, the latest projection error summary, and stale data indicators.

`/v1/diagnostics/indexer` adds local runtime process heartbeats for the API, indexer, and projection worker so App Core and developers can tell whether workers are running, stale, or unknown.

## Contributing

See `CONTRIBUTING.md` before opening a pull request or handing work back from an AI coding agent.

AI coding agents should follow `AGENTS.md`.
