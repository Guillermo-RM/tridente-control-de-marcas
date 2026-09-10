type CondominiumOption = { id: string; name: string };

export function CheckpointForm({
  action,
  checkpoint,
  condominiums,
  defaultCondominiumId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  checkpoint?: Record<string, unknown> | null;
  condominiums: CondominiumOption[];
  defaultCondominiumId?: string;
}) {
  return (
    <form action={action} className="entity-form">
      <label>Condominio<select defaultValue={String(checkpoint?.condominium_id ?? defaultCondominiumId ?? "")} name="condominiumId" required><option disabled value="">Selecciona uno</option>{condominiums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Nombre de la marca<input defaultValue={String(checkpoint?.name ?? "")} maxLength={120} name="name" placeholder="Acceso norte" required /></label>
      <label>Descripción<textarea defaultValue={String(checkpoint?.description ?? "")} maxLength={500} name="description" rows={3} /></label>
      <div className="form-row">
        <label>Latitud<input defaultValue={checkpoint?.latitude == null ? "" : String(checkpoint.latitude)} name="latitude" step="any" type="number" /></label>
        <label>Longitud<input defaultValue={checkpoint?.longitude == null ? "" : String(checkpoint.longitude)} name="longitude" step="any" type="number" /></label>
        <label>Radio permitido (m)<input defaultValue={String(checkpoint?.radius_meters ?? 75)} max={1000} min={10} name="radiusMeters" required type="number" /></label>
      </div>
      <button disabled={condominiums.length === 0} type="submit">Guardar punto QR</button>
    </form>
  );
}
