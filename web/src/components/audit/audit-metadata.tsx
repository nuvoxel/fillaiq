export function AuditMetadata({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  return (
    <div className="rounded-lg border border-border p-2 font-mono text-[0.8125rem] text-muted-foreground overflow-x-auto">
      <pre className="m-0">{JSON.stringify(metadata, null, 2)}</pre>
    </div>
  );
}
