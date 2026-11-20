# Household Investment Tracker — Docker wrapper

This wrapper builds the upstream `mwongr/household-investment-tracker` application
with minimal source changes (self-hosted font). It runs the production Vite frontend and the
existing Express API together on port 3001.

## Build from the upstream repository

Clone the upstream project, then add the files from this wrapper:

```sh
git clone https://github.com/mwongr/household-investment-tracker.git
cd household-investment-tracker
# Copy Dockerfile, compose.yaml, .dockerignore, .env.example,
# README-Docker.md, and docker/server.ts into this directory.
cp .env.example .env
```

By default the port is published on `127.0.0.1` only (this machine).
To reach it from any device on your LAN, publish on all interfaces and allow
private-network origins:

```dotenv
APP_BIND=0.0.0.0
APP_PORT=3001
ALLOWED_ORIGIN=private
```

`ALLOWED_ORIGIN` accepts a comma-separated list of exact origins
(e.g. `http://myhost.local:3001`), `private` (localhost, `*.local`,
`192.168.x.x`, `10.x`, `172.16–31.x`, IPv6 ULA) or `*` (any website — not
recommended, since any page open in your browser could then read your data).

> **Security:** the API has no authentication. CORS only restricts browsers;
> any device that can reach the port (e.g. `curl http://host:3001/api/state`)
> can read and overwrite your whole portfolio. Only use `0.0.0.0` on a trusted
> network, or put an authenticating reverse proxy in front of it.

Build and start:

```sh
docker compose up -d --build
```

Open `http://localhost:3001` or the hostname configured above.

## Persistent data

The bind mount `./data:/data` stores:

- `database.json` — the household tracker database
- `backups/` — rolling database snapshots

Back up the `data` directory regularly. The application also supports its
built-in JSON export/import workflow. Do not expose this service directly to
the public internet; it contains sensitive household financial information.

## Updating

Pull upstream changes and rebuild:

```sh
git pull
docker compose up -d --build
```

The existing `./data` directory is retained across rebuilds.

## Notes

- `.dockerignore` keeps `data/`, databases, backups and `.env` out of the
  build context, so your financial data is never baked into an image layer.
- The Inter font is self-hosted (`@fontsource/inter`) instead of loaded from
  Google Fonts, so the app makes no third-party calls except Yahoo Finance
  (ticker symbols) and the GitHub release check.
- Inside the container the server listens on `0.0.0.0:3001`; the upstream source defaults to
  loopback, so this wrapper calls its existing `startServer()` API with an
  explicit container bind address.
- The app uses the existing `HIT_DATA_DIR` setting to place its JSON database
  and snapshots in the persistent volume.
- This is a DIY/web deployment. Electron and Windows packaging are not run.
- The upstream project is licensed CC BY-NC 4.0. Review that license before
  redistributing modified or bundled copies.
