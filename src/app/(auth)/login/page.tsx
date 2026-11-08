import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth/guards";
import { hasPublicEnv } from "@/lib/env";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  if (!hasPublicEnv()) {
    return (
      <main className="centered-page">
        <section className="auth-card">
          <span className="eyebrow">Configuración pendiente</span>
          <h1>Conecta el entorno seguro</h1>
          <p>
            Copia las variables de <code>.env.example</code> a <code>.env.local</code>{" "}
            y vincula el proyecto de Supabase antes de iniciar sesión.
          </p>
        </section>
      </main>
    );
  }

  const context = await getAuthContext();
  if (context) {
    redirect(context.profile.role === "master" ? "/master/condominiums" : "/worker");
  }

  return (
    <main className="centered-page">
      <section className="auth-card">
        <Image className="brand-logo login-logo" src="/tridente-seguridad.webp" width={72} height={72} alt="Tridente Seguridad" />
        <span className="eyebrow">Tridente Control</span>
        <h1>Acceso seguro</h1>
        <p>Ingresa con la cuenta asignada por tu administrador.</p>
        <LoginForm next={typeof query.next === "string" ? query.next : undefined} />
        <small>Las cuentas no pueden registrarse públicamente.</small>
      </section>
    </main>
  );
}
