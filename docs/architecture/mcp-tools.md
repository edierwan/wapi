# MCP tools

Internal MCP (Model Context Protocol) server exposing WAPI data + actions
to AI agents in a **tenant-safe**, **permission-checked**, **auditable** way.

> Ships Phase 10. This doc is the contract.

## Why MCP

The alternative is to dump everything into the prompt ("here is the
price list, here is the FAQ, here are 20 contacts…"). That:

- breaks at scale
- leaks cross-tenant data if we're sloppy
- can't do writes safely
- can't be audited

MCP gives the agent a **toolbox**. Each tool call is a narrow RPC with
argument validation, tenant resolution, permission check, and an audit
record.

## Core rules

1. **Tenant never from client input.** Every tool resolves `tenantId` from
   the authenticated calling context. A client passing `tenant_id=X` is
   rejected.
2. **Permission-checked.** Each tool declares required permission code(s)
   (see [security.md](./security.md#role--permission-model)). Missing →
   `forbidden`.
3. **Destructive actions require confirmation.** Tools that mutate data
   annotated with `requires_confirm=true` return a preview on first call
   and only act when given a confirmation token.
4. **No direct WhatsApp send from MCP in MVP.** `sendWhatsAppMessage` is
   draft-only. Real send goes through the campaign/approval flow.
5. **Every tool call logs** to `audit_logs` with before/after when mutating.
6. **Rate-limited** per tenant and per caller.

## Tool catalog (v1)

### Tenant / profile

| Tool | Permission | Mutates |
|---|---|---|
| `getTenantProfile` | `settings.read` | no |
| `updateTenantProfile` | `settings.manage` | yes (confirm) |
| `getBusinessBrain` | `settings.read` | no — returns business profile + products + services + FAQ |

### Products

| Tool | Permission | Mutates |
|---|---|---|
| `listProducts` | `products.read` | no |
| `getProduct` | `products.read` | no |
| `searchProductByName` | `products.read` | no |
| `getProductPrice` | `products.read` | no |
| `createProductDraft` | `products.write` | yes (draft only — not active) |
| `updateProductDraft` | `products.write` | yes |

### Services

| Tool | Permission | Mutates |
|---|---|---|
| `listServices` | `services.read` | no |
| `getService` | `services.read` | no |
| `getServicePrice` | `services.read` | no |
| `getServiceAvailability` | `services.read` | no |

### Contacts

| Tool | Permission | Mutates |
|---|---|---|
| `listContacts` | `contacts.read` | no |
| `searchContacts` | `contacts.read` | no |
| `getContact` | `contacts.read` | no |
| `createContact` | `contacts.write` | yes |
| `tagContact` | `contacts.write` | yes |
| `setFollowUp` | `contacts.write` | yes |

### Campaigns

| Tool | Permission | Mutates |
|---|---|---|
| `createCampaignDraft` | `campaigns.create` | yes (status=draft) |
| `scheduleCampaign` | `campaigns.approve` | yes (confirm) |
| `getCampaignStats` | `campaigns.read` | no |
| `listCampaigns` | `campaigns.read` | no |

### Inbox

| Tool | Permission | Mutates |
|---|---|---|
| `getInboxThread` | `inbox.read` | no |
| `listInboxThreads` | `inbox.read` | no |
| `suggestReply` | `inbox.read` + `ai.use` | no |
| `createFollowUpTask` | `inbox.reply` | yes |
| `sendWhatsAppMessageDraftOnly` | `inbox.reply` | yes — **writes draft only**, no actual send |

### WhatsApp

| Tool | Permission | Mutates |
|---|---|---|
| `listWhatsAppAccounts` | `wa_accounts.manage` | no |
| `getWhatsAppAccountHealth` | `wa_accounts.manage` | no |

## Server shape

- One MCP server process (can run in-Next-process for Phase 10, extract later).
- Transport: STDIO for local agents, HTTP+SSE for hosted.
- Auth: signed short-lived JWT issued by WAPI to its own agent; JWT contains
  `userId`, `tenantId`, `role`, `exp`. No long-lived token passed to LLM.
- Schema: Zod per tool input + output.
- All tools live in `src/mcp/tools/*.ts`, wired via a shared
  `defineTool({ name, input, output, permissions, handler })` helper.

## How AI calls flow

```
User message in /t/{slug}/inbox
    │
    ▼
WAPI server starts an AI "session" (Dify/Ollama)
    │  + issues a short-lived MCP JWT (tenantId baked in)
    ▼
Agent reasons, picks tools, calls MCP endpoints
    │
    ▼
MCP handler validates → checks permission → runs → audit_log
    │
    ▼
Tool result flows back to agent → agent composes reply
    │
    ▼
Reply shown to human as suggestion. Human approves → campaign flow.
```

## Phasing

- Phase 5: **hard-code** in-process helpers (`getProduct`, `listContacts`) used by campaign drafter. Not yet MCP.
- Phase 7: extract to `src/mcp/tools/*.ts` with the shared helper, still in-process.
- Phase 10: expose real MCP server (HTTP+SSE) for external agents.
