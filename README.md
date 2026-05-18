# IsoniaOS Control Plane

Public indexing, projection, diagnostics, and REST read API for IsoniaOS governance read models.

## Status

Active development target: v0.8 accountability and integration preview.

Current package version is `0.8.0-alpha.2`. This wave adds execution permission registry read models on top of the public archive/accountability baseline while preserving the production authority model: contracts remain authoritative, and Control Plane remains an indexer, projector, explainer, and REST read API.

This repository is part of the public IsoniaOS open-source core. It is intended to be self-hostable and inspectable by DAO operators, developers, design partners, and future integrators.

## Authority Model

Control Plane is not a source of governance authority.

Smart contracts remain authoritative. Control Plane indexes chain events, stores raw events durably, builds replayable read models, explains proposal routes from indexed policy snapshots, exposes diagnostics, and serves typed REST APIs for App Core and SDK consumers.

If Control Plane state disagrees with chain state, chain state wins.

Archive, accountability, decision-record, execution-permission, and external-resource endpoints are read models. Execution target and selector rules are authoritative only because they are emitted by the configured IsoniaOS governance protocol contracts. External resources are evidence or context unless a future explicit model gives a source a narrower authority claim. Control Plane does not infer governance authority from arbitrary target-contract events.

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

`pnpm dev` starts the complete local Control Plane runtime:

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

This package consumes shared DTOs and enums through the pinned v0.8 compatibility tag:

```json
{
  "dependencies": {
    "@isonia/types": "github:isoniaos/types#v0.8.0-alpha.2"
  }
}
```

Do not duplicate shared DTOs locally. Add shared domain types to `@isonia/types` first.

## v0.8 Capabilities

Control Plane exposes activation capability metadata:

```txt
GET /v1/capabilities
```

The response reports serial activation as the fallback path. Contract-level typed batch activation and organization finalization are reported from deployment evidence: explicit deployment manifest capabilities, the configured protocol profile, and configured contract address presence. If Control Plane cannot prove a capability from that evidence, it reports `unknown` instead of deriving runtime behavior from package or release version strings. EIP-5792 remains unsupported/non-primary.

Typed batch calls still emit granular domain events, so read-model recovery remains event-driven and equivalent to serial setup where the underlying contracts emit the existing per-item events.

Old deployments are represented by Git tags, release artifacts, and deployment manifests. Compatibility metadata may be supplied through deployment capabilities, but active runtime capability reporting is not inferred from `@isonia/evm-contracts` package versions.

## Bootstrap Finalization

Control Plane can index the `OrganizationFinalized` event from configured governance protocol deployments and project organization finalization metadata for downstream clients:

```txt
GET /v1/orgs/:orgId/finalization
```

The read model reports whether finalization is supported, unknown, not finalized, or finalized, plus finalized admin, transaction, block, and chain timestamp metadata when the event is available. Finalized organizations remain active and readable. Post-finalization bootstrap admin restrictions are enforced by the contracts, not Control Plane.

Emergency/recovery flows and governance-controlled post-finalization mutations are not implemented in this alpha. This software remains unaudited alpha infrastructure and should not be used as production governance authority.

## v0.8 Archive And Accountability

The v0.8 baseline exposes public archive/accountability read endpoints:

```txt
GET /v1/orgs/:orgId/archive
GET /v1/orgs/:orgId/decision-records
GET /v1/orgs/:orgId/proposals/:proposalId/decision-record
GET /v1/orgs/:orgId/proposals/:proposalId/accountability
GET /v1/orgs/:orgId/proposals/:proposalId/external-resources
```

The first v0.8 wave does not add server-side archive filters; clients can filter the returned archive summaries locally.

Executed and cancelled governance proposals materialize accountability records from governance contract events. Executed proposals link to the observed transaction hash/status and generic proposal action metadata when available: target address, calldata hash, value, and future optional ABI/action metadata such as function selector.

`external_resources` is present as a durable read model for future import/fixture work. This task does not add provider API calls, importers, manual write endpoints, SaaS behavior, or UI.

Control Plane does not hardcode customer or demo-specific ABIs, does not index customer target contracts globally, and does not infer governance authority from arbitrary target-contract events. Future decoding should be modeled as optional ABI/action metadata or an explicit provider adapter.

## v0.8 Execution Permission Registry

Control Plane indexes the v0.8 IsoniaOS governance protocol events:

```txt
ExecutionTargetRuleUpdated
ExecutionSelectorRuleUpdated
```

These events materialize org-scoped execution target and selector rules in `execution_target_rules` and `execution_selector_rules`. The read endpoint is:

```txt
GET /v1/orgs/:orgId/execution-permissions
```

The endpoint returns shared `OrganizationExecutionPermissionsDto` data from `@isonia/types`.

Route explanation uses the registry only when capability evidence says it is supported by explicit deployment capabilities or the configured current protocol profile plus `GOV_PROPOSALS_ADDRESS`. If a supported registry has no enabled target rule, route explanation reports `execution_target_not_allowed`. If the proposal value exceeds the target max value, it reports `execution_value_limit_exceeded`. If selector rules exist but only the proposal calldata hash is available, it reports `execution_calldata_unavailable` rather than guessing.

This does not add arbitrary customer contract indexing, DemoTarget decoding, ABI-based action decoding, provider APIs, write endpoints, SaaS behavior, or external provider integrations.

## Indexer Configuration

```txt
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
GOV_CORE_ADDRESS=0x...
GOV_PROPOSALS_ADDRESS=0x...
ISONIA_PROTOCOL_PROFILE=current
ISONIA_DEPLOYMENT_CAPABILITIES_JSON={"activation":{"contractBatch":true},"finalization":{"organization":true},"execution":{"permissionRegistry":true}}
START_BLOCK=0
CONFIRMATIONS=0
BLOCK_RANGE_SIZE=1000
POLL_INTERVAL_MS=5000
API_PORT=3000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_CREDENTIALS=false
```

Leave contract address variables blank until local contracts are deployed. The zero address is rejected so placeholder config cannot be mistaken for an indexed protocol deployment.

`ISONIA_PROTOCOL_PROFILE=current` means the configured addresses are expected to point at the current IsoniaOS governance protocol implementation. `ISONIA_PROTOCOL_PROFILE=legacy` reports current typed activation/finalization/execution-permission capabilities as unsupported. `ISONIA_PROTOCOL_PROFILE=custom` is conservative and reports unknown unless `ISONIA_DEPLOYMENT_CAPABILITIES_JSON` supplies explicit capability statuses. Supported deployment capability values are `supported`, `unsupported`, `unknown`, `true`, and `false`.

REST API is exposed under `/v1`.

Diagnostics for operator support are available at:

```txt
GET /v1/diagnostics
GET /v1/diagnostics/indexer
GET /v1/capabilities
GET /v1/orgs/:orgId/finalization
GET /v1/orgs/:orgId/archive
GET /v1/orgs/:orgId/execution-permissions
```

The diagnostics response includes API version, configured chain and contract addresses, latest observed and safe blocks when RPC is available, indexer cursors, raw event counts, projection backlog/failures, the latest projection error summary, and stale data indicators.

Diagnostics also report whether `OrganizationFinalized` decoding is supported, the configured capability/profile evidence source for finalization, finalization event counts, and whether a finalization event is the latest failed projection.

`/v1/diagnostics/indexer` adds local runtime process heartbeats for the API, indexer, and projection worker so App Core and developers can tell whether workers are running, stale, or unknown.

## Contributing

See `CONTRIBUTING.md` before opening a pull request or handing work back from an AI coding agent.

AI coding agents should follow `AGENTS.md`.
