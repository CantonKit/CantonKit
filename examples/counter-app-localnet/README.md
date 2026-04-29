# counter-app-localnet

A minimal CantonKit demo that runs against a local Canton sandbox — no wallet or external accounts required.

It uses `LedgerProvider` (direct JSON Ledger API) and exercises all three data paths: read (`useContracts`), write (`useSubmit`), and stream (`useTransactionStream`).

## Prerequisites

| Tool | Notes |
|------|-------|
| JDK 17+ | Required by the Canton sandbox. macOS: `brew install --cask temurin@17` |
| [dpm](https://docs.digitalasset.com/build/3.4/dpm/dpm.html) | Digital Asset Package Manager, replaces the old Daml SDK |
| Node.js 20+ | For the frontend |
| pnpm | `npm i -g pnpm` |

## 1. Install dpm

```bash
curl -sSL https://get.digitalasset.com/install/install.sh | sh
```

add the dpm binary directory to your PATH:
```bash
export PATH="$HOME/.dpm/bin:$PATH"
```

Restart your shell (or `source ~/.bashrc` / `~/.zshrc`) so `dpm` is on your `PATH`.

## 2. Start the sandbox

```bash
cd daml

# Install the SDK version pinned in daml.yaml (one-time)
dpm install 3.4.11

# Build the Daml archive
# dpm build reads daml.yaml, uses the sdk-version to resolve dependencies,
# and compiles the Daml source files into a .dar archive at .daml/dist/counter-1.0.0.dar
dpm build

# Start the sandbox (no-auth mode, parties auto-allocated from daml.yaml)
dpm sandbox --dar .daml/dist/counter-1.0.0.dar
```

The sandbox prints its ports when ready:

```
Listening at ports: 6865(gRPC) and 6864(HTTP)
Canton sandbox is ready.
```

Note: the HTTP JSON Ledger API is on port **6864** — this must match `VITE_LEDGER_URL` in your `.env`.

Leave this terminal open — the sandbox must stay running.

## 3. Allocate a party

`dpm sandbox` does not pre-allocate parties. Create one via the HTTP API (the hint can be any string):

```bash
curl -s -X POST http://localhost:6864/v2/parties \
  -H "Content-Type: application/json" \
  -d '{"partyIdHint": "Alice", "displayName": "Alice"}'
```

Copy the `party` field from the response:

```json
{"partyDetails":{"party":"Alice::12206ddafd03ec2d5fad1f7ec093814a607c60981a7822e65472262de8447a6a7fe0","isLocal":true,...}}
```

> The hint is just a human-readable prefix — it does not need to match the `parties` list in `daml.yaml`.

## 4. Configure .env

```bash
cp .env.example .env
```

Edit `.env`:

```
# From the sandbox startup output: "Listening at ports: ... 6864(HTTP)"
VITE_LEDGER_URL=http://localhost:6864

# From the `party` field in the curl response in step 3
VITE_PARTY=Alice::12206ddafd03ec2d5fad1f7ec093814a607c60981a7822e65472262de8447a6a7fe0

# Leave empty — sandbox runs with no auth
VITE_TOKEN=
```

## 5. Start the frontend

In a second terminal, from this directory:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). You should see the Counter UI.

- Click **New counter** to create a Counter contract on the ledger.
- Click **+1** to exercise the `Increment` choice.
- The **Recent transactions** section streams live updates via WebSocket.

## How it works

```
App.tsx
└── LedgerProvider (ledgerUrl + party + static token from .env)
    ├── useContracts()         → GET /v2/query-acs
    ├── useSubmit()            → POST /v2/commands/submit-and-wait
    └── useTransactionStream() → WebSocket /v2/stream/transactions
```

The `Counter` Daml template lives in `daml/Counter.daml`. Its package ID (`#counter-1.0.0`) is embedded in `src/App.tsx` via `templateId(...)`.
