export function ErrorBanner({ message }: { message?: string }) {
  return message ? <p className="error-banner" role="alert">{message}</p> : null;
}
