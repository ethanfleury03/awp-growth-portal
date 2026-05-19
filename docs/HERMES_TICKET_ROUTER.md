# Hermes ticket router

AWP ticket events are queued in `ticket_agent_events` and delivered to the Mac mini Hermes router when these staging variables are configured:

```bash
HERMES_ROUTER_ENABLED=true
HERMES_ROUTER_WEBHOOK_URL=https://<mac-mini-router>/webhooks/wny-ticket
HERMES_ROUTER_WEBHOOK_SECRET=<shared-secret>
HERMES_ROUTER_BOARD=wny-awp
HERMES_ROUTER_ASSIGNEE=awp-agent
HERMES_ROUTER_PROFILE=awp-router
```

If the router is offline or the URL/secret are missing, ticket creation still succeeds and the event remains queued.

Manual dispatch:

```bash
curl -X POST "$APP_BASE_URL/api/internal/ticket-agent-events/dispatch" \
  -H "Authorization: Bearer $HERMES_ROUTER_DISPATCH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
```

The webhook body is signed with HMAC-SHA256 over:

```text
<X-WNY-Timestamp>.<raw JSON body>
```

Headers sent to the router:

```text
X-WNY-Event-Type
X-WNY-Idempotency-Key
X-WNY-Timestamp
X-WNY-Signature: sha256=<hex>
```
