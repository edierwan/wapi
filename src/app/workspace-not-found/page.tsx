import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const dynamic = "force-dynamic";

export default async function WorkspaceNotFoundPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; status?: string }>;
}) {
  const { slug, status } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Workspace not found
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {status === "suspended" && "This workspace is currently suspended."}
            {status === "disabled" && "This workspace has been disabled."}
            {!status && (
              <>
                We couldn&apos;t find a workspace
                {slug ? (
                  <>
                    {" "}
                    called <span className="font-mono">{slug}</span>.
                  </>
                ) : (
                  "."
                )}
              </>
            )}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
