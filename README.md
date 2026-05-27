# jpex-agent-kit

[English](README.md) | [日本語](README.ja.md)

Japanese-exchange-native AI trading toolkit. Lets an AI agent place **spot** trades on Japanese crypto exchanges through a single, local, key-safe interface.

> **This is a spot-only execution tool. It provides no investment advice, moves no funds off-exchange, and is intended for use with a user's own JFSA-registered exchange account.**

## Architecture

```
AI client (Claude / Cursor / VS Code)  ──MCP──►  jpex-trade-mcp ─┐
Human / scripts ───────────────────────CLI────►  jpex-trade-cli ─┤
                                                                  ▼
                                                        ┌──────────────────┐
                                                        │   jpex-core       │
                                                        │  • Tool Registry  │
                                                        │  • Permission gate│
                                                        │  • Local KeyStore │
                                                        │  • Exchange iface │
                                                        └─────────┬────────┘
                                                                  ▼
                                                  ┌────────────────────────────┐
                                                  │ adapters/bittrade           │
                                                  │  • Huobi-style REST client  │
                                                  │  • local HMAC-SHA256 signer │
                                                  │  • symbol/precision mapping │
                                                  └────────────────────────────┘
```

## Quick Start

### 1. Install

```bash
pnpm install
pnpm build
```

### 2. Configure

Create `~/.jpex/config.json`:

```json
{
  "exchange": "bittrade",
  "credentials": {
    "bittrade": {
      "accessKey": "YOUR_API_KEY",
      "secret": "YOUR_SECRET",
      "grantedPermissions": ["read", "trade"]
    }
  },
  "safety": {
    "maxOrderNotionalJpy": 100000,
    "requireConfirmOnWrite": true,
    "dryRun": false,
    "readOnly": false,
    "timeoutMs": 15000
  },
  "skills": ["jpex-spot-market", "jpex-spot-trade", "jpex-spot-portfolio", "jpex-retail"]
}
```

Then: `chmod 600 ~/.jpex/config.json`

### 3. CLI Usage

```bash
# List symbols
jpex market list_symbols

# Initialize/show/update config
jpex config init
jpex config show
jpex config set safety.readOnly true

# Diagnose local setup, MCP build, permissions, and endpoint reachability
jpex diagnose
jpex diagnose --skip-network

# Run any command surface in read-only mode
jpex --read-only market get_system_time

# Get ticker
jpex market get_ticker --symbol btcjpy

# Place order (dry run)
jpex trade place_spot_order --symbol btcjpy --side buy --type market --amount 0.01 --dry-run

# Place order (real, with confirmation)
jpex trade place_spot_order --symbol btcjpy --side buy --type market --amount 0.01 --yes
```

### 4. MCP (Cursor / Claude Desktop)

Add to your MCP config:

```json
{
  "mcpServers": {
    "jpex-trade": {
      "command": "node",
      "args": ["/path/to/packages/mcp/dist/server.js"],
      "env": {
        "JPEX_BITTRADE_ACCESS_KEY": "YOUR_KEY",
        "JPEX_BITTRADE_SECRET": "YOUR_SECRET"
      }
    }
  }
}
```

## Skills

| Skill | Tools | Permission |
|-------|-------|-----------|
| `jpex-spot-market` | list_symbols, get_currencies, get_system_time, get_ticker, get_all_tickers, get_orderbook, get_klines, get_last_trade, get_recent_trades | None (public) |
| `jpex-spot-trade` | place_spot_order, cancel_order, batch_cancel_orders, cancel_all_orders | trade |
| `jpex-spot-portfolio` | get_accounts, get_balances, get_open_orders, get_order, get_order_match_results, get_order_history, get_trade_history | read |
| `jpex-retail` | get_retail_quote_subscription, place_retail_order, get_retail_order_history, get_retail_maintenance_time | public/read/trade |

## Security Model

- API keys live **only** in `~/.jpex/config.json` (mode 600) or environment variables
- Keys are **never** sent to the LLM or any remote service other than the exchange
- All requests are **signed locally** using HMAC-SHA256
- Write operations require explicit confirmation (`--yes` flag or confirmation prompt)
- Configurable max order notional guardrail
- Global read-only mode disables all write tools even if the API key has `trade` permission
- Public/private/write requests are rate limited locally
- Write operations are appended to `~/.jpex/audit.log` with sensitive fields redacted
- `jpex diagnose` checks MCP build artifacts, config readability, declared permissions, and public/private endpoint availability

## Adding a New Exchange

Implement the `Exchange` interface from `jpex-core` and register it. The tool registry, CLI, and MCP layers need no changes.

## License

MIT
