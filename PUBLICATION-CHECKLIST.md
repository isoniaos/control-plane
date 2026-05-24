# Control Plane Publication Checklist

This checklist is for future repository publication or package-publication review. It is not a release plan and does not establish production, audit, public beta, SaaS, legal, provider-completeness, ISO launch, or token launch readiness.

## Before Publication

1. Confirm `.env`, local database files, private deployment manifests, keys, mnemonics, hosted RPC tokens, production database URLs, API keys, and customer data are not tracked.
2. Confirm package metadata, repository URLs, license metadata, README, SECURITY, CONTRIBUTING, AGENTS, and CHANGELOG are current.
3. Confirm current dependency refs are intentional and do not rely on floating branches for deployable builds.
4. Run the strongest relevant validation subset and record exact results.
5. Update the public docs repository if package/public repository URLs, setup, configuration, API behavior, or operator guidance changed.

## Do Not Do In This Checklist

- Do not bump package versions unless a release task explicitly scopes it.
- Do not create Git tags unless a release task explicitly scopes it.
- Do not introduce SaaS code or private hosted-operations details.
- Do not claim readiness without an explicit evidence gate.
