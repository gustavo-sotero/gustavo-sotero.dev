/**
 * Hashing utilities for IP addresses and other sensitive values.
 * Uses Web Crypto API (available in Bun) for SHA-256.
 */

/**
 * Hash a value with a salt using SHA-256.
 * Returns a hex-encoded string (64 chars).
 */
export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash an IP address with a salt for anonymous, irreversible storage.
 * The salt should be rotated periodically (e.g., daily) for enhanced privacy.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  return sha256(ip + salt);
}

/**
 * Generate a cryptographically secure random salt.
 */
export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
