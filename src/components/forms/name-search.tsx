"use client";

import { FormEvent, useEffect } from "react";

export function NameSearch({
  action,
  isFiltering,
  onChange,
  placeholder,
  value,
}: {
  action: string;
  isFiltering: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const url = value.trim()
        ? `${action}?q=${encodeURIComponent(value.trim())}`
        : action;
      window.history.replaceState(null, "", url);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [action, value]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form
      action={action}
      aria-busy={isFiltering}
      className="name-search"
      method="get"
      onSubmit={handleSubmit}
      role="search"
    >
      <div>
        <input
          aria-label="Buscar por nombre"
          id="name-search-input"
          maxLength={120}
          name="q"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        <button type="submit">Buscar</button>
      </div>
    </form>
  );
}
