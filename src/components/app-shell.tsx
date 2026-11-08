import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "@/app/actions/auth";
import { AppNavigation } from "@/components/app-navigation";
import { IncidentNotificationButton } from "@/components/incidents/incident-notification-button";
import type { AuthContext } from "@/lib/auth/types";

export function AppShell({
  context,
  initialUnreadIncidents,
  children,
}: {
  context: AuthContext;
  initialUnreadIncidents: number;
  children: React.ReactNode;
}) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link className="app-brand" href={context.profile.role === "master" ? "/master/condominiums" : "/worker"}>
          <Image className="brand-logo" src="/tridente-seguridad.webp" width={42} height={42} alt="" />
          <span>Tridente Control</span>
        </Link>
        <div className="user-menu">
          {context.profile.role === "master" ? <IncidentNotificationButton initialCount={initialUnreadIncidents} /> : null}
          <span>
            <strong>{context.profile.full_name}</strong>
            <small>{context.profile.role === "master" ? "userMaster" : "Trabajador"}</small>
          </span>
          <form action={logoutAction}>
            <button className="secondary-button" type="submit">Salir</button>
          </form>
        </div>
      </header>
      <AppNavigation role={context.profile.role} />
      <main className="app-content">{children}</main>
    </div>
  );
}
