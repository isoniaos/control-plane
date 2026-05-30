# IsoniaOS Control Plane Agent Instructions

## Scope

This repository owns the NestJS/PostgreSQL/viem indexing, projection, diagnostics, and REST read API layer for IsoniaOS.

It does not own governance authority, contract execution decisions, App Core UI, SDK packaging, SaaS billing or tenant administration, provider experiments, private production manifests, or integration-lab fixtures.

## Workspace Instruction Chain

When working inside the private IsoniaOS workspace, read:

1. `../AGENTS.md`
2. `../CURRENT_ROADMAP.md`
3. relevant `../private-docs/` index, governance, roadmap, and migration docs
4. this repository `AGENTS.md`
5. this repository `/docs` if present and `README.md`
6. current source/config files before editing

If this repository is cloned standalone, use this file as the local agent entry point and avoid relying on private workspace-only paths.

## Stack and Commands

- NestJS service under `src/`
- PostgreSQL schema and migrations in `src/database` and `src/scripts`
- EVM event indexing through `viem`
- Shared DTOs from `@isonia/types`
- In the private root workspace, local alpha work resolves `@isonia/types` through the root pnpm workspace link instead of a new GitHub alpha tag

Useful commands:

```bash
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm start
corepack pnpm dev
corepack pnpm indexer:start
corepack pnpm projections:start
corepack pnpm projections:rebuild
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
docker compose --env-file .env.docker -f docker-compose.local.yml config
git diff --check
```

`corepack pnpm lint` and `corepack pnpm format` are available but currently apply fixes/writes.

## Development Principles

- Treat contracts as authority for modeled onchain governance state; Control Plane indexes, explains, caches, and diagnoses.
- Preserve raw events before projection.
- Keep projections deterministic, idempotent, transaction-safe, and replayable.
- Keep event identity duplicate-safe and include `blockHash` where raw event integrity needs it.
- Distinguish RPC failure, indexing delay, projection delay, stale config, contract mismatch, capability mismatch, and database failure in diagnostics.
- Use `@isonia/types` for shared DTOs, enums, event names, setup structures, source disclosure, accountability, capabilities, and diagnostics shapes.
- Do not hardcode DemoTarget, customer ABI, provider, Sepolia lab, presentation, or package-version assumptions into core services.
- Do not add SaaS billing, hosted-customer provisioning, managed AI provider keys, private manifests, secrets, or customer data.
- Do not make production, audit, public beta, legal, SaaS, provider-completeness, grant, ISO launch, or token launch readiness claims.

## Documentation Rules

Update [`README.md`](README.md), `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` under `Unreleased` as relevant when API contracts, database schema, indexing behavior, diagnostics, deployment capability metadata, configuration, or authority boundaries change.

Update the public docs repository when changes affect public users, developers, operators, or public claims.

## Testing and Validation

For behavior changes, run the strongest relevant subset:

```bash
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
git diff --check
```

Run `corepack pnpm test:e2e` when API behavior changes. For documentation-only changes, `git diff --check` is normally sufficient.
