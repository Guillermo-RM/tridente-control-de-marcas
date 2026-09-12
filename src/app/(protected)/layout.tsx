import { AppShell } from "@/components/app-shell";
import { requireAuthenticated } from "@/lib/auth/guards";
import { getUnreadIncidentCount } from "@/lib/data/incidents";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const context = await requireAuthenticated();
  const unreadIncidents = await getUnreadIncidentCount(context);
  return <AppShell context={context} initialUnreadIncidents={unreadIncidents}>{children}</AppShell>;
}
