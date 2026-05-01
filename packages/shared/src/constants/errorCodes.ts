export const ERROR_TYPES = {
  VALIDATION: 'validation',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  CONFIGURATION: 'configuration',
  PROVIDER_TRANSIENT: 'provider_transient',
  PROVIDER_TERMINAL: 'provider_terminal',
  TIMEOUT: 'timeout',
  INTERNAL: 'internal',
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

// Standardized error codes used across the API
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  PROVIDER_TRANSIENT: 'PROVIDER_TRANSIENT',
  PROVIDER_TERMINAL: 'PROVIDER_TERMINAL',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const ERROR_TYPE_BY_CODE = {
  VALIDATION_ERROR: ERROR_TYPES.VALIDATION,
  UNAUTHORIZED: ERROR_TYPES.UNAUTHORIZED,
  FORBIDDEN: ERROR_TYPES.FORBIDDEN,
  NOT_FOUND: ERROR_TYPES.NOT_FOUND,
  CONFLICT: ERROR_TYPES.CONFLICT,
  RATE_LIMITED: ERROR_TYPES.RATE_LIMITED,
  CONFIGURATION_ERROR: ERROR_TYPES.CONFIGURATION,
  PROVIDER_TRANSIENT: ERROR_TYPES.PROVIDER_TRANSIENT,
  PROVIDER_TERMINAL: ERROR_TYPES.PROVIDER_TERMINAL,
  TIMEOUT: ERROR_TYPES.TIMEOUT,
  SERVICE_UNAVAILABLE: ERROR_TYPES.INTERNAL,
  INTERNAL_ERROR: ERROR_TYPES.INTERNAL,
} as const satisfies Record<ErrorCode, ErrorType>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.values(ERROR_CODES).includes(value as ErrorCode);
}

export function isErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && Object.values(ERROR_TYPES).includes(value as ErrorType);
}

export function getErrorTypeForCode(code: ErrorCode): ErrorType {
  return ERROR_TYPE_BY_CODE[code];
}
