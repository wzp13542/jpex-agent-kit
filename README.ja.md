# jpex-agent-kit

[English](README.md) | [日本語](README.ja.md)

日本国内取引所向け AI トレーディングツールキット。AI エージェントが、ローカルかつ安全なインターフェースを通じて、国内暗号資産取引所の**現物**取引を実行できます。

> **本ツールは現物取引専用の実行ツールです。投資助言は行わず、取引所以外への資金移動は行いません。ユーザー自身の金融庁登録済み取引所アカウントでの使用を前提としています。**

## アーキテクチャ

```
AI クライアント (Claude / Cursor / VS Code)  ──MCP──►  jpex-trade-mcp ─┐
人間 / スクリプト ─────────────────────────CLI────►  jpex-trade-cli ─┤
                                                                      ▼
                                                            ┌──────────────────┐
                                                            │   jpex-core       │
                                                            │  • ツールレジストリ│
                                                            │  • 権限ゲート      │
                                                            │  • ローカル鍵管理  │
                                                            │  • 取引所IF        │
                                                            └─────────┬────────┘
                                                                      ▼
                                                      ┌────────────────────────────┐
                                                      │ adapters/bittrade           │
                                                      │  • Huobi風 RESTクライアント  │
                                                      │  • ローカル HMAC-SHA256署名  │
                                                      │  • 銘柄/精度マッピング       │
                                                      └────────────────────────────┘
```

## クイックスタート

### 1. インストール

```bash
pnpm install
pnpm build
```

### 2. 設定

`~/.jpex/config.json` を作成してください：

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
    "dryRun": false
  },
  "skills": ["jpex-spot-market", "jpex-spot-trade", "jpex-spot-portfolio"]
}
```

設定ファイルの権限を制限：`chmod 600 ~/.jpex/config.json`

### 3. CLI の使い方

```bash
# 銘柄一覧
jpex market list-symbols

# ティッカー取得
jpex market get-ticker --symbol btcjpy

# 注文（ドライラン）
jpex trade place-spot-order --symbol btcjpy --side buy --type market --amount 0.01 --dry-run

# 注文（実行、確認あり）
jpex trade place-spot-order --symbol btcjpy --side buy --type market --amount 0.01 --yes
```

### 4. MCP（Cursor / Claude Desktop）

MCP 設定に追加：

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

## スキル一覧

| スキル | ツール | 必要な権限 |
|--------|--------|-----------|
| `jpex-spot-market` | list_symbols, get_ticker, get_orderbook, get_klines, get_recent_trades | なし（公開情報） |
| `jpex-spot-trade` | place_spot_order, cancel_order, cancel_all_orders | trade（取引） |
| `jpex-spot-portfolio` | get_balances, get_open_orders, get_order, get_order_history, get_trade_history | read（読取） |

## セキュリティモデル

- API キーは `~/.jpex/config.json`（モード600）または環境変数に**のみ**保存
- キーは LLM や取引所以外のリモートサービスに**一切送信されない**
- 全リクエストは HMAC-SHA256 で**ローカル署名**
- 書き込み操作は明示的な確認が必要（`--yes` フラグまたは確認プロンプト）
- 最大注文金額のガードレールを設定可能

## 新しい取引所の追加

`jpex-core` が提供する `Exchange` インターフェースを実装するだけ。ツールレジストリ、CLI、MCP 層の変更は不要です。

## 注意事項

- **現物取引のみ**対応（デリバティブ・レバレッジ・先物は対象外）
- **出金・送金機能なし**（読み取り＋取引のみ）
- BitTrade API の取引履歴は**約120日**まで（それ以前はCSV出力で対応）
- API キーに IP 制限を設定していない場合、**90日**で失効

## ライセンス

MIT
