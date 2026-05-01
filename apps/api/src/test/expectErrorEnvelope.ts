import { type ErrorCode, getErrorTypeForCode } from '@portfolio/shared/constants/errorCodes';
import { expect } from 'vitest';

export function expectErrorEnvelope(body: unknown, code: ErrorCode, message: string): void {
  expect(body).toEqual({
    success: false,
    error: {
      code,
      type: getErrorTypeForCode(code),
      message,
    },
  });
}
