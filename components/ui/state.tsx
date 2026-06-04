export function LoadingState({ label = "Yuklanmoqda..." }: { label?: string }) {
  return <div className="state-card loading">{label}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-card error">{message}</div>;
}

export function EmptyState({ label }: { label: string }) {
  return <div className="state-card empty">{label}</div>;
}
