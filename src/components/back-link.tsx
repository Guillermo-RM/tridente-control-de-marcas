import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return <div className="mb-4"><Link className="secondary-link" href={href}>← {label}</Link></div>;
}
