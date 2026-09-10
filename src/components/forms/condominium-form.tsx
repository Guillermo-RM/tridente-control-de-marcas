export function CondominiumForm({
  action,
  condominium,
}: {
  action: (formData: FormData) => void | Promise<void>;
  condominium?: Record<string, unknown> | null;
}) {
  return (
    <form action={action} className="entity-form">
      <label>Nombre<input defaultValue={String(condominium?.name ?? "")} maxLength={120} name="name" required /></label>
      <label>Dirección<textarea defaultValue={String(condominium?.address ?? "")} maxLength={300} name="address" required rows={3} /></label>
      <button type="submit">Guardar condominio</button>
    </form>
  );
}
