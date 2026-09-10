import Link from "next/link";

export default function NotFound() {
  return (
    <main className="centered-page">
      <section className="auth-card">
        <span className="eyebrow">404</span>
        <h1>Registro no encontrado</h1>
        <p>El elemento no existe, fue archivado o no pertenece a tu organización.</p>
        <Link className="primary-link" href="/">Volver al inicio</Link>
      </section>
    </main>
  );
}
