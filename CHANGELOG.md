# Changelog

All notable changes to `@isonia/control-plane` are documented here.

`package.json.version` uses SemVer without a leading `v`. Git tags use the matching version with a leading `v`.

## [Unreleased]

### Added

- Added selector-aware `ProposalCreated` decoding and proposal projection support for the v0.8.0-alpha.3 protocol action identity: target address, value, action selector, and calldata hash.
- Added route explanation checks that compare stored proposal action selectors against execution selector registry rules without requiring calldata.
- Added v0.8 execution permission registry indexing for `ExecutionTargetRuleUpdated` and `ExecutionSelectorRuleUpdated` IsoniaOS governance protocol events.
- Added replayable `execution_target_rules` and `execution_selector_rules` read models with idempotent org-scoped upserts.
- Added `GET /v1/orgs/:orgId/execution-permissions` returning the shared `OrganizationExecutionPermissionsDto` shape.
- Added conservative route explanation blockers for supported execution permission registries: disallowed targets, value-limit violations, and unavailable selector calldata.
- Added decoding and projection for the enriched canonical `ProposalExecuted` execution receipt emitted by `GovProposals`.
- Added `org_executors` and `proposal_execution_receipts` read models for org-scoped managed execution configuration and canonical execution receipts.
- Added `GET /v1/orgs/:orgId/managed-execution` returning the shared `OrganizationManagedExecutionDto` shape.
- Added direct/managed execution receipt DTO mapping, with direct execution represented when `managedExecutor` is the zero address.

### Changed

- Updated `ProposalDto` responses to expose the protocol-declared `actionSelector` when known.
- Updated `ProposalDto` responses to include `ProposalExecutionReceiptDto` information when the canonical execution receipt is available.
- Updated legacy selector behavior so missing proposal selectors remain explicit and conservative instead of being guessed from calldata hashes.
- Documented that Control Plane does not decode arbitrary customer ABIs or infer authority from target-contract events; the protocol-declared selector is a read-model action hint while calldata hash verification remains authoritative for the execution payload.
- Documented that `ProposalExecuted` is the canonical core execution receipt for direct and managed execution; target-contract events remain evidence/context unless explicitly modeled by a future adapter.
- Updated the package version to `0.8.0-alpha.4` and pinned `@isonia/types` to `github:isoniaos/types#v0.8.0-alpha.4`.
- Kept execution permission capability decisions tied to explicit deployment/profile/address evidence rather than package version strings.

## [0.8.0-alpha.1]

### Added

- Added the v0.8 public archive/accountability read-model baseline with accountability records, external resources, decision records, and public organization archive REST endpoints.
- Added v0.8 projection behavior that materializes accountability records for executed and cancelled proposals with linked transaction status and generic execution action metadata where available.

### Changed

- Updated the package version to `0.8.0-alpha.1` and pinned `@isonia/types` to `github:isoniaos/types#v0.8.0-alpha.1`.
- Replaced package-version-driven runtime capability assumptions with deployment/profile capability evidence via `ISONIA_PROTOCOL_PROFILE` and optional `ISONIA_DEPLOYMENT_CAPABILITIES_JSON`.

## [0.7.0-alpha.2]

### Added

- Indexed `OrganizationFinalized` and exposed organization finalization status/read metadata for downstream clients.

### Changed

- Updated the pinned `@isonia/types` dependency ref to `v0.7.0-alpha.2`.
- Updated v0.7 contract-version capability handling for finalization-aware deployments while preserving activation batch support for compatible v0.7 tags.

## [0.7.0-alpha.1]

### Added

- Added `GET /v1/capabilities` with activation capability metadata for v0.7 typed contract batch activation, including serial fallback and non-primary EIP-5792 reporting.

### Changed

- Updated the pinned `@isonia/types` dependency ref to `v0.7.0-alpha.1`.

## [0.6.0-alpha.2]

### Added

- Added `SECURITY.md` with alpha security posture, authority model, vulnerability reporting, diagnostics safety, and secret-handling guidance.
- Added `CONTRIBUTING.md` with local setup, verification commands, repository boundaries, and change-category rules.
- Added `LICENSE` for the public MIT-licensed Control Plane repository.
- Added `PUBLICATION-CHECKLIST.md` for making the existing repository public safely.

### Changed

- Added repository line-ending policy with `.gitattributes` for v0.6 hardening.
- Updated `AGENTS.md` with Control Plane-specific AI agent rules, public repository boundaries, authority model guardrails, v0.6 scope limits, and verification expectations.
- Updated `README.md` to describe Control Plane as part of the public open-source core and to document authority, repository boundary, security status, and verification commands.
- Updated `package.json` metadata for public repository publication by removing the private package flag and setting the license to MIT.

### Added

- Added v0.6 repository preparation context under `Unreleased`.
- Added `pnpm dev` as the complete local runtime for API, indexer, and projection worker.
- Added runtime startup logs for the API, indexer, and projection worker.
- Added `GET /v1/diagnostics/indexer` with API/indexer/projection heartbeat status and masked runtime diagnostics.
- Added runtime heartbeat storage for local process diagnostics.

### Changed

- Renamed development scripts to `api:dev`, `projections:start`, and `dev` while preserving manual indexer and projection commands.
- Made `projections:start` run continuously for local development.
- Disabled incremental emit for production builds so `nest build` recreates `dist` after cleaning it.
- Updated the pinned `@isonia/types` dependency ref to `v0.5.0-alpha.5`.

### Fixed

- Projection workers now claim only rows for the configured `CHAIN_ID`.
- Normal projection workers now skip failed raw events until manual retry or rebuild.
- Added `projections:retry-failed` for explicit failed-event requeue and processing.

## [0.5.0-alpha.3]

### Added

- Added this changelog for release tracking.

### Changed

- The `/v1/version` endpoint reports the package version from `package.json`.
- Application, script, indexer, projection, and test commands preload `.env` through `dotenv/config`.
- Local setup documentation now targets the v0.5 Developer Preview flow.

### Fixed

- Contract address configuration rejects the zero address so copied placeholder values cannot be indexed as real deployments.
- Generated TypeScript build-info files are ignored.

## [0.5.0-alpha.2]

### Added

- Added `GET /v1/orgs/:orgId/policies` as a read-only REST endpoint returning shared `OrganizationPoliciesDto` data.
- Added tests for empty policy lists, multiple policies, and org isolation.

## [0.5.0-alpha.1]

### Changed

- Aligned package metadata with the v0.5 alpha workspace.

## [0.1.0-alpha]

### Added

- Initial NestJS/PostgreSQL/viem Control Plane with indexing, projections, REST read models, diagnostics, and local scripts.

[Unreleased]: https://github.com/isoniaos/control-plane/compare/v0.8.0-alpha.1...HEAD
[0.8.0-alpha.1]: https://github.com/isoniaos/control-plane/releases/tag/v0.8.0-alpha.1
[0.7.0-alpha.2]: https://github.com/isoniaos/control-plane/releases/tag/v0.7.0-alpha.2
[0.7.0-alpha.1]: https://github.com/isoniaos/control-plane/releases/tag/v0.7.0-alpha.1
[0.6.0-alpha.2]: https://github.com/isoniaos/control-plane/releases/tag/v0.6.0-alpha.2
[0.5.0-alpha.3]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.3
[0.5.0-alpha.2]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.2
[0.5.0-alpha.1]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.1
[0.1.0-alpha]: https://github.com/isoniaos/control-plane/releases/tag/v0.1.0-alpha
