import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { appConfig } from "@/config/app";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Access denied
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            You don&apos;t have access to{" "}
            {slug ? (
              <>
                the workspace <span className="font-mono">{slug}</span>
              </>
            ) : (
              "this workspace"
            )}
            . Ask an owner to invite you, or{" "}
            <a
              href={`mailto:${appConfig.support.email}`}
              className="text-[var(--foreground)] underline"
            >
              contact support
            </a>
            .
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
