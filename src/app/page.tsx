import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/guards";
import { hasPublicEnv } from "@/lib/env";

export default async function Home() {
  if (!hasPublicEnv()) redirect("/login");
  const context = await getAuthContext();
  if (!context) redirect("/login");
  redirect(context.profile.role === "master" ? "/master/condominiums" : "/worker");
}
