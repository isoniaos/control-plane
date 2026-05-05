# Control Plane Public Repository Checklist

This archive is an overlay for the existing `isoniaos/control-plane` repository.

It assumes the repository history is safe to publish because development used only local Hardhat and local PostgreSQL data.

## Files in this archive

- `package.json` — removes the private package flag, changes license to MIT, and adds public repository metadata.
- `LICENSE` — MIT license text.
- `README.md` — updated public-core positioning, authority model, repository boundary, security status, and verification commands.
- `SECURITY.md` — new alpha security policy and disclosure guidance.
- `CONTRIBUTING.md` — new contributor workflow and repository boundary guide.
- `AGENTS.md` — updated Codex/AI-agent rules for Control Plane.
- `CHANGELOG.md` — updated under `Unreleased`.
- `PUBLICATION-CHECKLIST.md` — this file.

## Recommended apply flow

From the repository root:

    git checkout -b chore/public-control-plane-docs
    unzip control-plane-public-overlay.zip -d .
    corepack pnpm install
    corepack pnpm lint
    corepack pnpm test
    corepack pnpm build
    git diff --check
    git status
    git diff

Then review and commit.

## Repository visibility flow

After the commit is reviewed and merged:

1. Confirm that `.env` and local database files are not tracked.
2. Confirm no private keys, mnemonic phrases, hosted RPC tokens, production database URLs, or customer data exist in the current tree.
3. Confirm GitHub Actions logs and artifacts do not contain sensitive values.
4. Make the repository public in GitHub repository settings.
5. Verify that README, LICENSE, SECURITY, CONTRIBUTING, and AGENTS render correctly.
6. Update `isoniaos/docs` references if the public repository URL or package metadata changes.

## Do not do during this publication step

- Do not bump the package version.
- Do not create tags.
- Do not introduce SaaS code.
- Do not claim production readiness or audit status.
- Do not change REST DTOs or endpoint behavior.
