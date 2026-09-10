"use client";

export function PrintButton() {
  return <button className="secondary-button no-print" onClick={() => window.print()} type="button">Imprimir QR</button>;
}
