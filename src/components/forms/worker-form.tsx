type Option = { id: string; name: string };

export function WorkerForm({
  action,
  worker,
  condominiums,
  selectedIds = [],
  creating = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  worker?: Record<string, unknown> | null;
  condominiums: Option[];
  selectedIds?: string[];
  creating?: boolean;
}) {
  return (
    <form action={action} className="entity-form">
      <label>Nombre de usuario<input autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue={String(worker?.nickname ?? "")} minLength={3} maxLength={32} name="nickname" required /><small>Único en el sistema. Entre 3 y 32 caracteres, sin espacios ni tildes.</small></label>
      <label>Nombre completo<input defaultValue={String(worker?.full_name ?? "")} maxLength={120} name="fullName" required /></label>
      <label>Código de empleado<input defaultValue={String(worker?.employee_code ?? "")} maxLength={40} name="employeeCode" required /></label>
      {creating ? <label>Contraseña inicial<input autoComplete="new-password" name="password" required type="password" /></label> : null}
      <fieldset>
        <legend>Condominios asignados</legend>
        <div className="check-grid">
          {condominiums.map((condominium) => (
            <label className="check-option" key={condominium.id}>
              <input defaultChecked={selectedIds.includes(condominium.id)} name="condominiumIds" type="checkbox" value={condominium.id} />
              {condominium.name}
            </label>
          ))}
          {condominiums.length === 0 ? <p>Primero crea un condominio activo.</p> : null}
        </div>
      </fieldset>
      <button type="submit">Guardar trabajador</button>
    </form>
  );
}
