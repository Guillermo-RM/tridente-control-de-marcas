import { requireMaster } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AuditPage() {
  const context = await requireMaster();
  const { data, error } = await createAdminClient().from("audit_logs")
    .select("id, created_at, action, entity_type, actor_user_id, ip_address")
    .eq("organization_id", context.profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error("No se pudo cargar la auditoría.");

  return (
    <section>
      <span className="eyebrow">Trazabilidad administrativa</span>
      <h1>Auditoría</h1>
      <p className="lead">Eventos recientes de acceso y cambios realizados por cuentas maestras.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Usuario</th><th>IP</th></tr></thead>
          <tbody>
            {(data ?? []).map((event) => (
              <tr key={event.id}>
                <td>{new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" }).format(new Date(event.created_at))}</td>
                <td><code>{event.action}</code></td>
                <td>{event.entity_type}</td>
                <td>{event.actor_user_id ?? "Sistema"}</td>
                <td>{event.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.length ? <p className="empty-state">No hay eventos de auditoría.</p> : null}
      </div>
    </section>
  );
}
