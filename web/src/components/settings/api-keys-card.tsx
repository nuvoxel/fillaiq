"use client";

import { useState, useTransition } from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import { authClient } from "@/lib/auth-client";
import type { ApiKeyInfo } from "@/lib/actions/dashboard";

type Props = {
  initialApiKeys: ApiKeyInfo[];
};

export function ApiKeysCard({ initialApiKeys }: Props) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [isPending, startTransition] = useTransition();

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");

  // Show-key dialog (after generation)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyOpen, setShowKeyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.apiKey.create({
          name: keyName.trim() || undefined,
          expiresIn: undefined,
        });
        if (result.error) {
          setError(result.error.message ?? "Failed to create API key");
          return;
        }
        const newKey = result.data?.key;
        setGenerateOpen(false);
        setKeyName("");

        if (newKey) {
          setGeneratedKey(newKey);
          setShowKeyOpen(true);
        }

        // Refresh key list
        const listResult = await authClient.apiKey.list();
        if (listResult.data) {
          setApiKeys(
            listResult.data.map((k: any) => ({
              id: k.id,
              name: k.name,
              prefix: k.prefix ?? k.start ?? null,
              enabled: k.enabled ?? true,
              createdAt: new Date(k.createdAt),
              lastRequest: k.lastRequest ? new Date(k.lastRequest) : null,
            }))
          );
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleDelete = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await authClient.apiKey.delete({ keyId: id });
        if (result.error) {
          setError(result.error.message ?? "Failed to delete API key");
          return;
        }
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
        setDeleteId(null);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const handleCopy = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="API Keys"
          titleTypographyProps={{ fontWeight: 600 }}
          action={
            <Button
              size="small"
              startIcon={<KeyIcon />}
              variant="outlined"
              onClick={() => {
                setKeyName("");
                setError(null);
                setGenerateOpen(true);
              }}
            >
              Generate Key
            </Button>
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}
          {apiKeys.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <KeyIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No API keys configured.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Key Prefix</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Used</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.name ?? "Unnamed"}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          color="text.secondary"
                        >
                          {key.prefix ?? "---"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={key.enabled ? "Active" : "Disabled"}
                          size="small"
                          color={key.enabled ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {key.lastRequest
                          ? new Date(key.lastRequest).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteId(key.id)}
                          disabled={isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Generate API Key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Key Name (optional)"
            placeholder="e.g. Production, CI/CD"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog
        open={showKeyOpen}
        onClose={() => {
          setShowKeyOpen(false);
          setGeneratedKey(null);
          setCopied(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>API Key Generated</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy this key now. You will not be able to see it again.
          </Alert>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: "grey.100",
              borderRadius: 1,
              p: 1.5,
              fontFamily: "monospace",
              fontSize: "0.85rem",
              wordBreak: "break-all",
            }}
          >
            <Box sx={{ flex: 1 }}>{generatedKey}</Box>
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
          {copied && (
            <Typography
              variant="caption"
              color="success.main"
              sx={{ mt: 0.5, display: "block" }}
            >
              Copied to clipboard
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setShowKeyOpen(false);
              setGeneratedKey(null);
              setCopied(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete API Key</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this API key? Any integrations using
            it will stop working immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteId && handleDelete(deleteId)}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
