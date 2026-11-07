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
      <label>
        Nickname
        <input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          name="nickname"
          placeholder="juan.perez"
          minLength={3}
          maxLength={32}
          required
          type="text"
        />
      </label>
      <div className="grid gap-2">
        <label htmlFor="login-password">Contraseña</label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            autoComplete="current-password"
            id="login-password"
            name="password"
            required
            type={passwordVisible ? "text" : "password"}
          />
          <button
            aria-controls="login-password"
            aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="min-w-24"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? "Ocultar" : "Mostrar"}
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
