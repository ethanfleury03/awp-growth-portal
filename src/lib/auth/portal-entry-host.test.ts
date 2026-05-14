import { describe, expect, it } from 'vitest';
import { normalizeRequestHost, shouldRouteRootToPortalApp } from './portal-entry-host';

describe('portal app entry host routing', () => {
  it('normalizes host names with ports and casing', () => {
    expect(normalizeRequestHost('AWP.WNYAUTOMATION.COM:443')).toBe('awp.wnyautomation.com');
  });

  it('routes portal custom-domain root traffic into the app', () => {
    expect(shouldRouteRootToPortalApp('awp.wnyautomation.com', '/')).toBe(true);
    expect(shouldRouteRootToPortalApp('staging.awp.wnyautomation.com', '/')).toBe(true);
  });

  it('leaves non-root and non-portal hosts alone', () => {
    expect(shouldRouteRootToPortalApp('awp.wnyautomation.com', '/features')).toBe(false);
    expect(shouldRouteRootToPortalApp('app.wnyautomation.com', '/')).toBe(false);
    expect(shouldRouteRootToPortalApp('wnyautomation.com', '/')).toBe(false);
  });
});
