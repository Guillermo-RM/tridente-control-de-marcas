import Link from "next/link";

import { logoutAction } from "@/app/actions/auth";
import { AppNavigation } from "@/components/app-navigation";
import type { AuthContext } from "@/lib/auth/types";

export function AppShell({
  context,
  children,
}: {
  context: AuthContext;
  children: React.ReactNode;
}) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link className="app-brand" href={context.profile.role === "master" ? "/master/condominiums" : "/worker"}>
          <span className="brand-mark small" aria-hidden="true">T</span>
          <span>Tridente Control</span>
        </Link>
        <div className="user-menu">
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
