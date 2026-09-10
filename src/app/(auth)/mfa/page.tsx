import { redirect } from "next/navigation";

import { requireAuthenticated } from "@/lib/auth/guards";

export default async function MfaPage() {
  const context = await requireAuthenticated();
  redirect(context.profile.role === "master" ? "/master/condominiums" : "/worker");
}
