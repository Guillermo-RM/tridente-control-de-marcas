"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="centered-page">
      <section className="auth-card">
        <span className="eyebrow">Error inesperado</span>
        <h1>No pudimos completar la operación</h1>
        <p>Vuelve a intentarlo. Si el problema continúa, contacta al administrador.</p>
        <button className="primary-link" onClick={reset} type="button">Reintentar</button>
      </section>
    </main>
  );
}
