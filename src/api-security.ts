// API security: loopback-only enforcement for helper endpoints

const HELPER_PATHS = [
  '/api/log',
  '/api/vstart',
  '/api/vframe',
  '/api/vend',
  '/api/tile',
  '/api/finish'
];

const LOOPBACK_ADDRESSES = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1'
];

/**
 * Check if a request to a given path from a remote address should be allowed.
 * Helper endpoints are restricted to loopback; /api/lan-ip is public.
 */
export function isHelperAllowed(path: string, remoteAddr: string): boolean {
  // If not a helper path, allow
  if (!HELPER_PATHS.includes(path)) {
    return true;
  }
  
  // Helper paths: only allow from loopback
  return LOOPBACK_ADDRESSES.includes(remoteAddr);
}

export { HELPER_PATHS };
