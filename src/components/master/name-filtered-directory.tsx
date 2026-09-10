"use client";

import { ReactNode, useDeferredValue, useMemo, useState } from "react";

import { NameSearch } from "@/components/forms/name-search";

type DirectoryItem = {
  content: ReactNode;
  id: string;
  name: string;
};

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function NameFilteredDirectory({
  action,
  actions,
  emptyMessage,
  initialQuery,
  items,
  placeholder,
}: {
  action: string;
  actions?: ReactNode;
  emptyMessage: string;
  initialQuery: string;
  items: DirectoryItem[];
  placeholder: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const filteredItems = useMemo(() => {
    const term = normalizeName(deferredQuery.trim());
    return term ? items.filter((item) => normalizeName(item.name).includes(term)) : items;
  }, [deferredQuery, items]);

  return (
    <>
      <NameSearch
        action={action}
        isFiltering={query !== deferredQuery}
        onChange={setQuery}
        placeholder={placeholder}
        value={query}
      />
      {actions ? <div className="directory-primary-action">{actions}</div> : null}
      <div className="entity-list">
        {filteredItems.map((item) => <div className="entity-list-item" key={item.id}>{item.content}</div>)}
        {filteredItems.length === 0 ? <p className="empty-state">{emptyMessage}</p> : null}
      </div>
    </>
  );
}
