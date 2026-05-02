# IsoniaOS Control Plane

Indexing, projection, diagnostics, and REST read API for IsoniaOS governance read models.

## Status

Active development target: v0.6 alpha preparation.

Current package version remains `0.5.0-alpha.3`, the closed v0.5
compatibility tag. The Control Plane remains REST-only and is not a source of
governance authority.

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
corepack pnpm db:migrate
corepack pnpm dev
```

`pnpm dev` starts the complete local Control Plane runtime for the current v0.6
baseline inherited from the closed v0.5 compatibility set:

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

`projections:retry-failed` clears failed projection markers for the configured
`CHAIN_ID` and immediately attempts to process the requeued rows. Normal
projection workers skip failed rows until this manual retry path or a full
`projections:rebuild` is run.

## Shared Package Dependency

This package consumes shared DTOs and enums through the pinned known-good v0.5
compatibility tag:

```json
{
  "dependencies": {
    "@isonia/types": "github:isoniaos/types#v0.5.0-alpha.5"
  }
}
```

Indexer configuration:

```txt
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
GOV_CORE_ADDRESS=0x...
GOV_PROPOSALS_ADDRESS=0x...
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
```

The diagnostics response includes API version, configured chain and contract
addresses, latest observed and safe blocks when RPC is available, indexer
cursors, raw event counts, projection backlog/failures, the latest projection
error summary, and stale data indicators.

`/v1/diagnostics/indexer` adds local runtime process heartbeats for the API,
indexer, and projection worker so App Core and developers can tell whether
workers are running, stale, or unknown.
