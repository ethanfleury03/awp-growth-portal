export type GatewayAccessAllowed = {
  configured: true;
  allowed: true;
  companyId: string;
  companyName: string;
  role: string;
  destinationKey: string;
};

type GatewayAccessDenied = {
  configured: true;
  allowed: false;
  reason: string;
};

type GatewayAccessSkipped = {
  configured: false;
  allowed: true;
  reason: "not_configured";
};

export type GatewayAccessResult =
  | GatewayAccessAllowed
  | GatewayAccessDenied
  | GatewayAccessSkipped;

function cleanGatewayUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getGatewayAccessConfig(env: NodeJS.ProcessEnv = process.env) {
  const gatewayUrl = cleanGatewayUrl(env.PORTAL_GATEWAY_URL || env.NEXT_PUBLIC_PORTAL_GATEWAY_URL || "");
  const serviceToken = (env.PORTAL_GATEWAY_SERVICE_TOKEN || "").trim();
  const destinationKey = (env.PORTAL_GATEWAY_DESTINATION_KEY || "awp-growth-portal").trim();

  return {
    configured: Boolean(gatewayUrl && serviceToken && destinationKey),
    gatewayUrl,
    serviceToken,
    destinationKey,
  };
}

export async function verifyGatewayPortalAccess({
  clerkUserId,
  email,
}: {
  clerkUserId: string;
  email: string;
}): Promise<GatewayAccessResult> {
  const config = getGatewayAccessConfig();
  if (!config.configured) {
    return { configured: false, allowed: true, reason: "not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${config.gatewayUrl}/api/internal/access/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clerkUserId,
        email,
        destinationKey: config.destinationKey,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        configured: true,
        allowed: false,
        reason: `gateway_${response.status}`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (data.allowed === true) {
      return {
        configured: true,
        allowed: true,
        companyId: String(data.companyId || ""),
        companyName: String(data.companyName || ""),
        role: String(data.role || ""),
        destinationKey: String(data.destinationKey || config.destinationKey),
      };
    }

    return {
      configured: true,
      allowed: false,
      reason: String(data.reason || data.error || "gateway_denied"),
    };
  } catch (error) {
    return {
      configured: true,
      allowed: false,
      reason: error instanceof Error ? error.message : "gateway_unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
