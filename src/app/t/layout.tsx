import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const dynamic = "force-dynamic";

export default async function TenantRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser("/login");
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar
        user={{ email: user.email, name: user.name }}
        showMarketingLinks={false}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
