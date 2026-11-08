"use client";

import { useActionState, useState } from "react";

import {
  loginAction,
  type LoginState,
} from "@/app/(auth)/login/actions";

const INITIAL_STATE: LoginState = { message: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL_STATE);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={next ?? ""} />
      <input
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        name="nickname"
        placeholder="Nombre de usuario"
        aria-label="Nombre de usuario"
        minLength={3}
        maxLength={32}
        required
        type="text"
      />
      <div className="grid gap-2">
        <div className="login-password-field">
          <input
            autoComplete="current-password"
            id="login-password"
            name="password"
            placeholder="Contraseña"
            aria-label="Contraseña"
            required
            type={passwordVisible ? "text" : "password"}
          />
          <button
            aria-controls="login-password"
            aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="login-password-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {passwordVisible ? (
                <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M6.1 6.1A14 14 0 0 0 2 12s3.6 6 10 6a11 11 0 0 0 4.4-.9M10 6.2a11 11 0 0 1 2-.2c6.4 0 10 6 10 6a15 15 0 0 1-2.1 2.6" />
              ) : (
                <>
                  <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
      {state.message ? (
        <p aria-live="polite" className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button disabled={pending} type="submit">
        {pending ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
