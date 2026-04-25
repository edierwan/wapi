"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { draftReplyAction, type DraftReplyState } from "./actions";

const initial: DraftReplyState = { ok: false };

export function DraftReplyForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(draftReplyAction, initial);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Draft a reply</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />

            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted-foreground)]">
                Customer message
              </span>
              <textarea
                required
                name="customerMessage"
                rows={5}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Paste the latest customer message here…"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[var(--muted-foreground)]">Task</span>
              <select
                name="task"
                defaultValue="draft_reply"
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="draft_reply">Draft a reply</option>
                <option value="summarize">Summarize</option>
                <option value="classify_intent">Classify intent</option>
              </select>
            </label>

            <Button type="submit" disabled={pending}>
              {pending ? "Generating…" : "Generate draft"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {state.error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[color:var(--destructive,#b91c1c)]">
              Could not generate draft
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{state.error}</CardContent>
        </Card>
      ) : null}

      {state.ok && state.draft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
              {state.draft}
            </pre>
            {state.meta ? (
              <div className="text-xs text-[var(--muted-foreground)]">
                provider: <code>{state.meta.providerName}</code> · key:{" "}
                <code>{state.meta.conversationKey}</code> ·{" "}
                {state.meta.latencyMs} ms
              </div>
            ) : null}
            <p className="text-xs text-[var(--muted-foreground)]">
              Review before sending. This draft is not stored anywhere.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
