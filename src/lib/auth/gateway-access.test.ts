import { describe, expect, it, vi, afterEach } from 'vitest';
import { getGatewayAccessConfig, verifyGatewayPortalAccess } from './gateway-access';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  vi.restoreAllMocks();
});

describe('gateway access config', () => {
  it('is skipped until required env vars are present', () => {
    delete process.env.PORTAL_GATEWAY_URL;
    delete process.env.PORTAL_GATEWAY_SERVICE_TOKEN;
    expect(getGatewayAccessConfig().configured).toBe(false);
  });

  it('uses the AWP destination key by default', () => {
    process.env.PORTAL_GATEWAY_URL = 'https://app.wnyautomation.com/';
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN = 'secret';
    const config = getGatewayAccessConfig();
    expect(config.configured).toBe(true);
    expect(config.gatewayUrl).toBe('https://app.wnyautomation.com');
    expect(config.destinationKey).toBe('awp-growth-portal');
  });
});

describe('verifyGatewayPortalAccess', () => {
  it('allows access when the gateway confirms the destination', async () => {
    process.env.PORTAL_GATEWAY_URL = 'https://app.wnyautomation.com';
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN = 'secret';
    process.env.PORTAL_GATEWAY_DESTINATION_KEY = 'awp-growth-portal';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          allowed: true,
          companyId: 'company_1',
          companyName: 'AWP',
          role: 'admin',
          destinationKey: 'awp-growth-portal',
        }),
        { status: 200 },
      ),
    );

    const result = await verifyGatewayPortalAccess({
      clerkUserId: 'user_1',
      email: 'client@example.com',
    });

    expect(result.allowed).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://app.wnyautomation.com/api/internal/access/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );
  });

  it('denies access when the gateway denies the user', async () => {
    process.env.PORTAL_GATEWAY_URL = 'https://app.wnyautomation.com';
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN = 'secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ allowed: false, reason: 'destination_not_allowed' }), {
        status: 200,
      }),
    );

    const result = await verifyGatewayPortalAccess({
      clerkUserId: 'user_1',
      email: 'client@example.com',
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('destination_not_allowed');
  });
});
