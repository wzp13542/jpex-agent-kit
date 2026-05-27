import type { Exchange, Permission } from "./types.js";
import { ConfigError } from "./errors.js";
import { BitTradeClient } from "./adapters/bittrade/client.js";

export interface ExchangeFactoryOptions {
  accessKey: string;
  secret: string;
  permissions: Permission[];
  timeoutMs?: number;
}

type ExchangeFactory = (options: ExchangeFactoryOptions) => Exchange;

const factories = new Map<string, ExchangeFactory>();

export function registerExchange(id: string, factory: ExchangeFactory): void {
  factories.set(id, factory);
}

export function createExchange(id: string, options: ExchangeFactoryOptions): Exchange {
  const factory = factories.get(id);
  if (!factory) {
    throw new ConfigError(`Unknown exchange "${id}". Registered exchanges: ${Array.from(factories.keys()).join(", ")}`);
  }
  return factory(options);
}

export function listExchanges(): string[] {
  return Array.from(factories.keys());
}

registerExchange("bittrade", (options) =>
  new BitTradeClient(options.accessKey, options.secret, options.permissions, {
    timeoutMs: options.timeoutMs,
  }),
);
