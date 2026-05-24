# Security Policy

## Project status

IsoniaOS Control Plane is alpha software.

It is intended for local development, self-hosted demos, design-partner evaluation, and early protocol integration work. It has not been independently audited and must not be represented as production-hardened treasury governance infrastructure.

Do not use this repository to secure production DAO treasuries, protocol upgrades, or legally binding governance processes without an explicit review, deployment plan, and security assessment appropriate to that environment.

## Authority model

Control Plane is not a source of governance authority.

The authoritative state for governance actions lives in the configured smart contracts. Control Plane indexes events, stores raw event history, builds replayable read models, exposes diagnostics, and serves typed REST APIs.

If Control Plane output disagrees with chain state, chain state wins.

The public App Core may display transaction controls, but those controls are UI hints. Contract authorization and execution rules remain final.

## Supported versions

During active development, only the active `main` branch and the latest explicitly announced tag receive security attention.

Historical `v0.1` and `v0.5` materials are archival unless maintainers explicitly reopen them for a compatibility or disclosure task.

## Reporting a vulnerability

Please report suspected vulnerabilities privately before opening a public issue.

Recommended report contents:

- affected repository and commit or tag;
- clear description of the issue;
- affected component: configuration, REST API, database, indexing, projections, diagnostics, dependencies, or documentation;
- reproduction steps using local development data where possible;
- expected impact;
- whether any secret, key, account, organization, or deployed environment may be affected.

If no private disclosure channel has been published yet, contact the maintainers through the official IsoniaOS organization channels and ask for a private security contact. Do not publish exploit details until a maintainer has had a reasonable opportunity to review the report.

## What to report

Report issues such as:

- unauthorized write authority or governance authority leaking into Control Plane;
- diagnostics exposing secrets, private configuration, credentials, or sensitive operator data;
- database migrations or projection bugs that can corrupt or misrepresent governance history;
- replay/rebuild bugs that make read models non-deterministic;
- indexing bugs that silently skip or duplicate events;
- chain ID or contract address confusion that can mix unrelated deployments;
- unsafe CORS defaults for non-local deployments;
- dependency vulnerabilities with practical exploitability;
- documentation that could cause unsafe production use or secret leakage.

## What is out of scope for security reports

During active development, the following are normally not treated as security vulnerabilities unless they create a concrete exploit path:

- missing production deployment hardening;
- performance limitations in local demo workflows;
- incomplete current-roadmap features;
- known lack of third-party audit;
- failures caused by intentionally invalid local configuration;
- issues in abandoned archival documentation that is clearly marked as historical.

## Secrets and configuration

The repository must not contain real secrets.

Allowed in the repository:

- `.env.example` with local placeholder values;
- local Hardhat RPC URLs;
- local Postgres examples;
- zero-value or placeholder contract address instructions, when clearly marked as placeholders.

Not allowed in the repository:

- private keys;
- mnemonic phrases;
- real RPC provider tokens;
- production `DATABASE_URL` values;
- API keys;
- hosted service credentials;
- customer data;
- private deployment manifests.

The `.env` file must remain ignored by git.

## Diagnostics safety

Diagnostics are part of the trust and operator-support surface.

Diagnostics should help distinguish API status, chain/RPC status, contract address configuration, indexer cursor state, projection backlog, failed projections, stale data, and runtime worker heartbeat state.

Diagnostics must not expose secrets. Sensitive values must be masked, omitted, or represented through safe status indicators.

## Dependency and supply-chain hygiene

Use pinned Isonia package tags or immutable commit refs before public beta.

Do not depend on floating branches for deployable builds. Keep dependency updates focused, review lockfile changes carefully, and avoid unrelated upgrades during security-sensitive work.

## Coordinated disclosure expectations

Maintainers should acknowledge credible private reports, investigate impact, prepare a fix or mitigation, and publish a security note when appropriate.

Reporters should avoid public disclosure until a fix, mitigation, or maintainer response window has been completed.
