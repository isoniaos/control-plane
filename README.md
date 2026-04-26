# control-plane

This module is part of the **IsoniaOS** workspace.

## Purpose

See `../docs/repository-boundaries.md` and `../docs/v0.1-tz.md`.

## For v0.1

- keep the scope minimal
- stay within the current architecture boundaries
- keep changes aligned with the specifications in `../docs/`

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

## Commands

```txt
corepack pnpm db:migrate
corepack pnpm indexer:start
corepack pnpm worker:projections
corepack pnpm projections:rebuild
corepack pnpm start:dev
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
```

REST API is exposed under `/v1`.
