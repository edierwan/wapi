# WAPI Customer Memory Core

Planning entry for the future **Smart Customer Memory** enhancement.

See the architecture detail:

- [customer-memory-core.md](../architecture/customer-memory-core.md)

Summary:

- tenant-level knowledge memory
- customer memory keyed by `tenant_id + normalized_phone_number`
- conversation memory with rolling summaries
- WAPI-owned memory records with Dify used as workflow / agent layer
- future CRM surfaces for profile, timeline, memory summary, follow-up task, and delete/export controls
- strict multi-tenant isolation and privacy controls

Product positioning target:

```text
WhatsApp CRM + AI Memory + Follow-up Automation
```

Product message:

```text
WAPI gives every business an AI WhatsApp assistant that remembers customers,
understands previous conversations, and follows up automatically.
```