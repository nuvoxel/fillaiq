import Paper from "@mui/material/Paper";

export function AuditMetadata({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        fontFamily: "monospace",
        fontSize: "0.8125rem",
        color: "text.secondary",
        overflowX: "auto",
        borderRadius: 2,
      }}
    >
      <pre style={{ margin: 0 }}>{JSON.stringify(metadata, null, 2)}</pre>
    </Paper>
  );
}
