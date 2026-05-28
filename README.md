# IsoniaOS Control Plane

Control Plane is the IsoniaOS indexing, projection, diagnostics, and REST read API service. It ingests configured EVM governance contract events, stores raw events, builds replayable read models, and exposes public read surfaces for organization state, proposals, routes, archives, accountability, external resources, capabilities, and diagnostics.

Control Plane is not governance authority. If a read model disagrees with modeled contract state, the modeled contract state wins. The public developer overview is in [site/developers/index.md](https://github.com/isoniaos/docs/blob/main/site/developers/index.md).

## Installation

Requires Node.js 22 or newer, pnpm through Corepack, and PostgreSQL.

```bash
corepack pnpm install
```

During coordinated alpha work in the private IsoniaOS workspace, `@isonia/types` is resolved through the root pnpm workspace link. Standalone consumers should use a coherent release tag or provide the same local workspace layout; ordinary alpha development does not require new GitHub alpha tags.

Copy or adapt [`.env.example`](.env.example) for local development.

## Configuration

Configuration is read by [`src/config/app-config.service.ts`](src/config/app-config.service.ts).

| Variable | Default / behavior |
| --- | --- |
| `NODE_ENV` | `development` |
| `API_PORT` / `PORT` | API port, default `3000`; `API_PORT` wins |
| `CHAIN_ID` | EVM chain ID, default `31337` |
| `RPC_URL` / `RPC_HTTP_URL` | RPC endpoint, default `http://127.0.0.1:8545`; `RPC_URL` wins |
| `ISONIA_CORE_ADDRESS` | Optional non-zero EVM address for `IsoCore` |
| `ISONIA_PROPOSALS_ADDRESS` | Optional non-zero EVM address for `IsoProposals` |
| `ISONIA_PROTOCOL_PROFILE` | Optional profile: `current`, `legacy`, or `custom` |
| `ISONIA_DEPLOYMENT_CAPABILITIES_JSON` | Optional JSON object that overrides deployment capabilities |
| `START_BLOCK` | Indexer start block, default `0` |
| `CONFIRMATIONS` / `CONFIRMATION_DEPTH` | Confirmation depth, default `0`; `CONFIRMATIONS` wins |
| `BLOCK_RANGE_SIZE` / `MAX_BLOCK_RANGE` | Indexer block range, default `1000`; `BLOCK_RANGE_SIZE` wins |
| `POLL_INTERVAL_MS` | Indexer poll interval, default `5000` |
| `DATABASE_URL` | Full PostgreSQL URL; overrides individual `PG_*` values |
| `PG_HOST` | Default `localhost` |
| `PG_PORT` | Default `5432` |
| `PG_DATABASE` | Default `control-plane` |
| `PG_USER` | Default `postgres` |
| `PG_PASSWORD` | Default `secret` |
| `CORS_ORIGINS` | Comma-separated origins, default `http://localhost:5173,http://127.0.0.1:5173` |
| `CORS_CREDENTIALS` | Boolean, default `false` |

Do not use package version strings as runtime capability evidence. Use configured contract addresses, profile/capability metadata, ABI/event compatibility, and observable chain state.

## Run / Usage

Create or update the database schema:

```bash
corepack pnpm db:migrate
```

Run the API:

```bash
corepack pnpm start
```

Run API, indexer, and projections together in development:

```bash
corepack pnpm dev
```

Run individual workers:

```bash
corepack pnpm indexer:start
corepack pnpm projections:start
corepack pnpm projections:rebuild
```

Build and test:

```bash
corepack pnpm build
corepack pnpm test
corepack pnpm test:e2e
```

## Troubleshooting

- Invalid `ISONIA_CORE_ADDRESS` or `ISONIA_PROPOSALS_ADDRESS` values fail startup; use full non-zero `0x` addresses.
- If database connection fails, prefer one clear `DATABASE_URL` or verify all `PG_*` values together.
- If browser calls fail, confirm `CORS_ORIGINS` includes the App Core origin.
- If capability metadata is wrong or missing, check `ISONIA_PROTOCOL_PROFILE` and `ISONIA_DEPLOYMENT_CAPABILITIES_JSON`.
- If read models look stale, check runtime heartbeats, projection errors, and whether `projections:rebuild` is needed after schema or projection changes.

## Contribution

Read [`AGENTS.md`](AGENTS.md) before editing. Keep indexing deterministic, idempotent, transaction-safe, and replayable. Preserve raw events before projection and keep SQL parameterized or strictly whitelisted.

Update the smallest relevant local docs and the public docs repository when API contracts, DB schema, indexing behavior, diagnostics, capability metadata, configuration, or authority boundaries affect users, developers, operators, or public claims.

## License

MIT. See [`LICENSE`](LICENSE).
