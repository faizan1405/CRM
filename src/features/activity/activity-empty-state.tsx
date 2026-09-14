export function ActivityEmptyState({ hasNotes }: { hasNotes?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <p>{hasNotes ? "No activity found." : "No activity yet."}</p>
    </div>
  );
}
