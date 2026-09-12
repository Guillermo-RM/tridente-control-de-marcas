import { redirect } from "next/navigation";

export default async function WorkerIncidentsPage() {
  redirect("/worker/reports");
}
