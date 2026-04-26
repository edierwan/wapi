# WAPI Customer Memory Core

Alternative internal name: `Client Memory Core`

Preferred product-facing name: **Smart Customer Memory**

## Purpose

WAPI must become more than WhatsApp blast + AI automation.

The product needs a tenant-owned memory layer where each business can:

- remember its own customers by phone number
- understand previous conversations
- continue follow-ups naturally
- keep business knowledge and customer knowledge grounded inside WAPI

This memory must never leak across tenants.

Canonical identity anchor:

```text
tenant_id + normalized_phone_number
```

Examples:

- Clinic A + `60123456789` = Farah's memory for Clinic A
- Clinic B + `60123456789` = separate memory for Clinic B

These are different customer-memory records even when the phone number is the same.

## Position in the product

This is a future enhancement, not a current implementation tranche.

It extends the existing tenant-scoped foundations already present in WAPI:

- tenant business profile
- products / services
- Business Brain (`business_memory_items`)
- Dify provider resolution and tenant-scoped AI context
- WhatsApp account and conversation ownership

WAPI remains the system of record. Dify remains the AI workflow layer.

## Memory layers

### 1. Tenant Knowledge Memory

Stores business-level knowledge for each tenant.

Examples:

- business name
- industry
- services / products
- pricing / FAQ
- operating hours
- location
- tone of voice
- policies

This is the business context AI uses to answer as that tenant.

Existing WAPI overlap:

- `tenant_settings`
- `tenant_business_profiles`
- `products`
- `services`
- `business_memory_items`

Future direction:

- formalize this into a reusable tenant knowledge layer for inbox, campaigns,
  replies, follow-ups, and AI extraction jobs

### 2. Customer Memory

Stores customer-level memory per tenant.

Identity key:

```text
tenant_id + normalized_phone_number
```

Examples:

- customer name
- preferred language
- interest / asked product / asked service
- lead status
- tags
- objections
- budget if mentioned
- last conversation summary
- next action / follow-up intent

This must be tenant-scoped at the row level and query level.

### 3. Conversation Memory

Stores message history and compressed summaries.

The goal is not to send full raw chat history to AI every time.
Instead, WAPI should combine:

- recent messages
- a rolling compressed summary
- the current incoming message

Purpose:

- AI can continue the conversation naturally
- customer does not need to repeat previous details
- token cost stays bounded

## Dify integration plan

Dify should be the AI workflow / agent layer, not the memory system of record.

WAPI should build the memory context before calling Dify.

Structured context sent by WAPI can include:

- tenant profile
- tenant knowledge summary
- customer memory summary
- recent conversation messages
- current incoming WhatsApp message

Target flow:

```text
WAPI retrieves tenant + customer + conversation memory
-> WAPI builds structured context payload
-> WAPI calls Dify workflow / agent
-> Dify returns the AI response
-> WAPI stores the response and message records
-> WAPI updates memory asynchronously
```

Guardrail:

- Dify must not become the only source of truth for memory
- WAPI database must own the memory records, lifecycle, privacy controls, and tenancy boundaries

## Memory update flow

After each meaningful customer interaction, WAPI should update memory asynchronously.

Candidate extracted fields:

- customer name
- language
- intent
- interest
- lead stage
- objection
- appointment / request details
- next follow-up action

This update path can be implemented later via:

- a Dify extraction workflow
- or an internal WAPI AI extraction job

The extraction worker should write back into WAPI-owned memory tables.

## Dashboard / CRM planning

Future tenant-facing CRM surfaces should include:

- Customer Profile
- Memory Summary
- Conversation Timeline
- Tags / Lead Stage
- Next Follow-up Task
- manual edit / delete memory
- forget customer / delete customer memory

Important UX rule:

- internal memory summaries are for tenant operators and internal AI context
- internal memory text must never be exposed directly to customers

## Privacy and multi-tenant safety

Hard requirements:

- all memory tables must include `tenant_id`
- every query must be scoped by `tenant_id`
- phone number identity is never global; it is always combined with tenant ownership

Future privacy controls:

- delete customer memory
- export customer data
- disable AI memory per tenant
- disable AI memory per customer

Additional safety rules:

- memory text must not leak across tenants
- raw extraction artifacts should not be shown directly to customers
- retention, export, and delete paths should align with later audit/compliance work

## Suggested future tables

Planning only. Do not treat this list as an immediate migration order.

Core:

- `tenants`
- `tenant_profiles`
- `tenant_knowledge_items`
- `customers`
- `conversations`
- `messages`
- `customer_memories`
- `followup_tasks`

Future advanced:

- `tenant_knowledge_embeddings`
- `customer_memory_embeddings`

Modeling note:

- existing WAPI tables such as `business_memory_items`, `inbound_messages`,
  `message_queue`, and later inbox tables may partially overlap with this shape
- when implementation time comes, prefer evolving the current tenant-scoped model
  carefully instead of duplicating competing memory stores

## Suggested inbound WhatsApp flow

```text
Incoming WhatsApp message
-> identify tenant from connected WhatsApp account / inbox
-> normalize phone number
-> find or create customer using tenant_id + phone_number
-> retrieve tenant profile / knowledge
-> retrieve customer memory
-> retrieve recent conversation messages
-> build Dify context payload
-> call Dify workflow / agent
-> send reply through WhatsApp
-> store message
-> asynchronously update memory summary and follow-up task
```

Important rule:

- tenant resolution comes from WAPI ownership of the account / inbox, never from request-body claims or Dify output

## Positioning expansion

WAPI should not be marketed only as WhatsApp blast + AI automation.

Future positioning target:

```text
WhatsApp CRM + AI Memory + Follow-up Automation
```

Product message:

```text
WAPI gives every business an AI WhatsApp assistant that remembers customers,
understands previous conversations, and follows up automatically.
```

## Implementation notes

- do not depend on external AI memory GitHub repositories as the core foundation
- external memory projects may be used as inspiration only
- WAPI must own the data model, tenant isolation, memory lifecycle, and privacy controls
- Dify is the AI workflow layer, not the system of record
- normalized phone number is the customer identity anchor, but always combined with `tenant_id`

## Recommended phase placement

Recommended future sequencing:

- Phase 8: inbox / conversation model groundwork
- Phase 9+: tenant CRM memory surfaces, edit/delete/export controls
- later: embeddings, richer follow-up automation, multi-channel memory continuity

This enhancement should stay planning-only until the shared inbox and conversation model are ready.