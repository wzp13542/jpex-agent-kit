export type JpexErrorType =
  | "JpexConfigError"
  | "JpexValidationError"
  | "JpexReadOnlyError"
  | "JpexRateLimitError"
  | "BitTradeApiError"
  | "JpexHttpError"
  | "JpexNetworkError";

export interface StructuredErrorPayload {
  tool?: string;
  type: JpexErrorType;
  code?: string;
  endpoint?: string;
  message: string;
  timestamp: string;
}

export class JpexError extends Error {
  readonly type: JpexErrorType;
  readonly code?: string;
  readonly endpoint?: string;

  constructor(type: JpexErrorType, message: string, options: { code?: string; endpoint?: string } = {}) {
    super(message);
    this.name = type;
    this.type = type;
    this.code = options.code;
    this.endpoint = options.endpoint;
  }
}

export class ConfigError extends JpexError {
  constructor(message: string) {
    super("JpexConfigError", message);
  }
}

export class ValidationError extends JpexError {
  constructor(message: string) {
    super("JpexValidationError", message);
  }
}

export class ReadOnlyError extends JpexError {
  constructor(toolName: string) {
    super("JpexReadOnlyError", `Tool "${toolName}" is disabled because read-only mode is enabled.`, {
      code: "READ_ONLY",
    });
  }
}

export class RateLimitError extends JpexError {
  constructor(bucket: string) {
    super("JpexRateLimitError", `Rate limit exceeded for ${bucket}.`, { code: "RATE_LIMIT" });
  }
}

export class HttpError extends JpexError {
  constructor(message: string, options: { code?: string; endpoint?: string } = {}) {
    super("JpexHttpError", message, options);
  }
}

export class NetworkError extends JpexError {
  constructor(message: string, options: { code?: string; endpoint?: string } = {}) {
    super("JpexNetworkError", message, options);
  }
}

export class BitTradeApiError extends JpexError {
  constructor(message: string, options: { code?: string; endpoint?: string } = {}) {
    super("BitTradeApiError", message, options);
  }
}

export function toStructuredError(error: unknown, tool?: string): StructuredErrorPayload {
  if (error instanceof JpexError) {
    return {
      tool,
      type: error.type,
      code: error.code,
      endpoint: error.endpoint,
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    tool,
    type: "JpexNetworkError",
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  };
}
