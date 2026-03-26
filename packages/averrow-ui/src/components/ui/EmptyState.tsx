export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-contrail/40 text-sm">
      {message}
    </div>
  );
}
