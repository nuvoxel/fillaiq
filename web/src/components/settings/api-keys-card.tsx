"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import type { ApiKeyInfo } from "@/lib/actions/dashboard";

type Props = {
  initialApiKeys: ApiKeyInfo[];
  cardSx?: unknown;
  titleSx?: unknown;
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
            (listResult.data.apiKeys ?? listResult.data).map((k: any) => ({
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
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-xl flex items-center gap-1.5 before:content-[''] before:inline-block before:w-1 before:h-5 before:rounded-sm before:bg-[#00D2FF] before:shrink-0">
              API Keys
            </h3>
            <Button
              size="sm"
              onClick={() => {
                setKeyName("");
                setError(null);
                setGenerateOpen(true);
              }}
              className="bg-[#00D2FF] text-[#00566a] hover:bg-[#00bce6]"
            >
              <KeyRound className="size-4 mr-1" />
              Generate New Key
            </Button>
          </div>

          <div className="border-t border-border" />

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-4">
              <KeyRound className="size-10 text-muted-foreground/40 mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">
                No API keys configured.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Name</TableHead>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Value</TableHead>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Status</TableHead>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Created</TableHead>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Last Used</TableHead>
                  <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <span className="text-sm font-bold">
                        {key.name ?? "Unnamed"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {key.prefix ?? "---"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.enabled ? "default" : "secondary"}
                        className={key.enabled ? "bg-green-100 text-green-600" : ""}
                      >
                        {key.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {key.lastRequest
                          ? new Date(key.lastRequest).toLocaleDateString()
                          : "Never"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(key.id)}
                        disabled={isPending}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium block mb-1">Key Name (optional)</label>
            <Input
              autoFocus
              placeholder="e.g. Production, CI/CD"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="bg-[#00D2FF] text-[#00566a] hover:bg-[#00bce6]"
            >
              {isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Generated Key Dialog */}
      <Dialog
        open={showKeyOpen}
        onOpenChange={(open) => {
          setShowKeyOpen(open);
          if (!open) {
            setGeneratedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
          </DialogHeader>
          <Alert className="border-amber-300 bg-amber-50">
            <AlertDescription className="text-amber-800">
              Copy this key now. You will not be able to see it again.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1.5 font-mono text-sm break-all">
            <span className="flex-1">{generatedKey}</span>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
              <Copy className="size-4" />
            </Button>
          </div>
          {copied && (
            <p className="text-xs font-bold text-green-500">
              Copied to clipboard
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyOpen(false);
                setGeneratedKey(null);
                setCopied(false);
              }}
              className="bg-[#00D2FF] text-[#00566a] hover:bg-[#00bce6]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? Any integrations using
              it will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
