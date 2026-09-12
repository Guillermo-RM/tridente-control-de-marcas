"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Profile } from "@/lib/auth/types";

type NavigationItem = {
  activePaths: string[];
  href: string;
  label: string;
};

const masterItems: NavigationItem[] = [
  { href: "/master/condominiums", label: "Condominios", activePaths: ["/master/condominiums"] },
  { href: "/master/workers", label: "Trabajadores", activePaths: ["/master/workers"] },
  { href: "/master/reports", label: "Reportes", activePaths: ["/master/reports"] },
  { href: "/master/incidents", label: "Incidencias", activePaths: ["/master/incidents"] },
  { href: "/master/audit", label: "Auditoría", activePaths: ["/master/audit"] },
];

const workerItems: NavigationItem[] = [
  { href: "/worker", label: "Escanear código", activePaths: ["/worker", "/scan"] },
  { href: "/worker/reports", label: "Reportes", activePaths: ["/worker/reports", "/worker/incidents"] },
];

export function AppNavigation({ role }: { role: Profile["role"] }) {
  const pathname = usePathname();
  const items = role === "master" ? masterItems : workerItems;

  return (
    <nav className={`app-nav ${role === "worker" ? "worker-nav" : ""}`} aria-label="Navegación principal">
      {items.map((item) => {
        const active = item.activePaths.some((path) => (
          pathname === path || (role === "master" && pathname.startsWith(`${path}/`))
        ));
        return (
          <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
