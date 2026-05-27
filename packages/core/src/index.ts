// Types & interfaces
export * from "./types.js";

// Registry
export {
  type ToolDef,
  type ToolContext,
  type SkillId,
  registerTool,
  getRegistry,
  getRegistryBySkill,
  getRegistryByPermission,
  clearRegistry,
} from "./registry.js";

// Config & key store
export {
  type JpexConfig,
  type ResolvedConfig,
  type ExchangeCredentials,
  type SafetyConfig,
  loadConfig,
  resolveConfig,
  getConfigPath,
  validateFilePermissions,
  writeConfig,
  redact,
  redactConfig,
} from "./keystore.js";

// Errors & observability
export {
  JpexError,
  ConfigError,
  ValidationError,
  ReadOnlyError,
  RateLimitError,
  HttpError,
  NetworkError,
  BitTradeApiError,
  toStructuredError,
} from "./errors.js";
export { AuditLogger } from "./audit.js";
export { runDiagnostics } from "./diagnostics.js";
export type { DiagnosticCheck, DiagnosticOptions, DiagnosticReport, DiagnosticStatus } from "./diagnostics.js";
export { RateLimiter } from "./rate-limiter.js";
export { HttpClient, unwrapBitTradeResponse } from "./http-client.js";
export { registerExchange, createExchange, listExchanges } from "./exchange-registry.js";

// Permissions
export { filterToolsByPermission, probePermissions } from "./permissions.js";

// Tools (call these to register all tools)
export { registerMarketTools } from "./tools/market.js";
export { registerPortfolioTools } from "./tools/portfolio.js";
export { registerTradeTools } from "./tools/trade.js";
export { registerRetailTools } from "./tools/retail.js";

// BitTrade adapter
export { BitTradeClient } from "./adapters/bittrade/client.js";
