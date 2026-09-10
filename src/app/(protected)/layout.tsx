import { AppShell } from "@/components/app-shell";
import { requireAuthenticated } from "@/lib/auth/guards";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const context = await requireAuthenticated();
  return <AppShell context={context}>{children}</AppShell>;
}
