import { redirect } from "next/navigation";

import { getWorker } from "@/lib/data/master";

export default async function WorkerIncidentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { worker } = await getWorker(id);
  redirect(worker ? `/master/incidents?workerId=${id}` : "/master/workers");
}
