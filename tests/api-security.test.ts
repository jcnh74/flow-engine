// API security test: verify helper endpoints are restricted to loopback

import { describe, test, expect } from 'bun:test';
import { isHelperAllowed, HELPER_PATHS } from '../src/api-security';

describe('API Security', () => {
  const loopbackAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const lanAddress = '192.168.8.50';
  
  test('helper paths should be restricted to loopback', () => {
    for (const path of HELPER_PATHS) {
      for (const addr of loopbackAddresses) {
        expect(isHelperAllowed(path, addr)).toBe(true);
      }
      // LAN address should be denied
      expect(isHelperAllowed(path, lanAddress)).toBe(false);
    }
  });
  
  test('lan-ip endpoint should be publicly accessible', () => {
    const path = '/api/lan-ip';
    
    // Should allow from loopback
    for (const addr of loopbackAddresses) {
      expect(isHelperAllowed(path, addr)).toBe(true);
    }
    
    // Should also allow from LAN
    expect(isHelperAllowed(path, lanAddress)).toBe(true);
  });
  
  test('all helper paths are covered', () => {
    expect(HELPER_PATHS).toContain('/api/log');
    expect(HELPER_PATHS).toContain('/api/vstart');
    expect(HELPER_PATHS).toContain('/api/vframe');
    expect(HELPER_PATHS).toContain('/api/vend');
    expect(HELPER_PATHS).toContain('/api/tile');
    expect(HELPER_PATHS).toContain('/api/finish');
    expect(HELPER_PATHS).not.toContain('/api/lan-ip');
  });
  
  test('IPv4 loopback', () => {
    expect(isHelperAllowed('/api/log', '127.0.0.1')).toBe(true);
    expect(isHelperAllowed('/api/vstart', '127.0.0.1')).toBe(true);
  });
  
  test('IPv6 loopback', () => {
    expect(isHelperAllowed('/api/log', '::1')).toBe(true);
    expect(isHelperAllowed('/api/vend', '::1')).toBe(true);
  });
  
  test('IPv6-mapped IPv4 loopback', () => {
    expect(isHelperAllowed('/api/tile', '::ffff:127.0.0.1')).toBe(true);
    expect(isHelperAllowed('/api/finish', '::ffff:127.0.0.1')).toBe(true);
  });
  
  test('LAN addresses rejected for helpers', () => {
    expect(isHelperAllowed('/api/log', '192.168.8.50')).toBe(false);
    expect(isHelperAllowed('/api/vstart', '10.0.0.5')).toBe(false);
    expect(isHelperAllowed('/api/tile', '172.16.0.10')).toBe(false);
  });
});
