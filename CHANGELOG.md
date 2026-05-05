# Changelog

All notable changes to `@isonia/control-plane` are documented here.

`package.json.version` uses SemVer without a leading `v`. Git tags use the matching version with a leading `v`.

## [Unreleased]

### Added

- Added `SECURITY.md` with alpha security posture, authority model, vulnerability reporting, diagnostics safety, and secret-handling guidance.
- Added `CONTRIBUTING.md` with local setup, verification commands, repository boundaries, and change-category rules.
- Added `LICENSE` for the public MIT-licensed Control Plane repository.
- Added `PUBLICATION-CHECKLIST.md` for making the existing repository public safely.

### Changed

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

[Unreleased]: https://github.com/isoniaos/control-plane/compare/v0.5.0-alpha.3...HEAD
[0.5.0-alpha.3]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.3
[0.5.0-alpha.2]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.2
[0.5.0-alpha.1]: https://github.com/isoniaos/control-plane/releases/tag/v0.5.0-alpha.1
[0.1.0-alpha]: https://github.com/isoniaos/control-plane/releases/tag/v0.1.0-alpha
