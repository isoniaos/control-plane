# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /workspace

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY types/package.json ./types/package.json
COPY control-plane/package.json ./control-plane/package.json

RUN corepack pnpm install --frozen-lockfile --filter @isonia/control-plane... --ignore-scripts

COPY types ./types
COPY control-plane ./control-plane

RUN corepack pnpm --filter @isonia/types build
RUN corepack pnpm --filter @isonia/control-plane build

FROM node:22-bookworm-slim AS runtime

WORKDIR /workspace/control-plane

ENV NODE_ENV=production
ENV API_PORT=3000

COPY --from=build --chown=node:node /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/
COPY --from=build --chown=node:node /workspace/node_modules /workspace/node_modules
COPY --from=build --chown=node:node /workspace/types /workspace/types
COPY --from=build --chown=node:node /workspace/control-plane /workspace/control-plane
COPY control-plane/docker/control-plane-entrypoint.sh /usr/local/bin/control-plane-entrypoint

RUN chmod +x /usr/local/bin/control-plane-entrypoint

USER node

EXPOSE 3000

ENTRYPOINT ["control-plane-entrypoint"]
