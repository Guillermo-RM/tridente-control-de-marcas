"use client";

import { useActionState } from "react";

import {
  loginAction,
  type LoginState,
} from "@/app/(auth)/login/actions";

const INITIAL_STATE: LoginState = { message: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL_STATE);

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
      <label>
        Contraseña
        <input
          autoComplete="current-password"
          name="password"
          required
          type="password"
        />
      </label>
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
