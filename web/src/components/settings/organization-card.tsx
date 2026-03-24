"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, Users, User, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Org = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function OrganizationCard({
  cardSx: _cardSx,
  titleSx: _titleSx,
}: {
  cardSx?: unknown;
  titleSx?: unknown;
} = {}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isPending, startTransition] = useTransition();

  const fetchOrgs = async () => {
    try {
      const { data } = await authClient.organization.list();
      if (data) setOrgs(data as Org[]);

      const active = await authClient.organization.getFullOrganization();
      if (active?.data) setActiveOrg(active.data as unknown as Org);
    } catch {
      // No orgs or not in one
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleSetActive = (orgId: string) => {
    startTransition(async () => {
      await authClient.organization.setActive({ organizationId: orgId });
      fetchOrgs();
    });
  };

  const handleUsePersonal = () => {
    startTransition(async () => {
      await authClient.organization.setActive({ organizationId: null as any });
      setActiveOrg(null);
    });
  };

  const handleCreate = () => {
    if (!newOrgName.trim()) return;
    const slug =
      newOrgSlug.trim() ||
      newOrgName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    startTransition(async () => {
      await authClient.organization.create({ name: newOrgName.trim(), slug });
      setCreateOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      fetchOrgs();
    });
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-xl flex items-center gap-1.5 before:content-[''] before:inline-block before:w-1 before:h-5 before:rounded-sm before:bg-[#00D2FF] before:shrink-0">
            Organization
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4 mr-1" />
            Create
          </Button>
        </div>

        <div className="border-t border-border" />

        {loading ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <div>
            {/* Personal */}
            <button
              onClick={handleUsePersonal}
              disabled={isPending}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                !activeOrg ? "bg-muted" : "hover:bg-muted/50"
              } disabled:opacity-50`}
            >
              <User className="size-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Personal</p>
                <p className="text-xs text-muted-foreground">Use your individual library</p>
              </div>
              {!activeOrg && <Check className="size-5 text-green-500 shrink-0" />}
            </button>

            <div className="border-t border-border" />

            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSetActive(org.id)}
                disabled={isPending}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeOrg?.id === org.id ? "bg-muted" : "hover:bg-muted/50"
                } disabled:opacity-50`}
              >
                <Users className="size-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{org.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                </div>
                {activeOrg?.id === org.id && (
                  <Check className="size-5 text-green-500 shrink-0" />
                )}
              </button>
            ))}

            {orgs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No organizations yet. Create one to share your library with team members.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Org Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Organizations let multiple users share scan stations, spools, and inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Organization Name</label>
              <Input
                autoFocus
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Slug (optional)</label>
              <Input
                placeholder="auto-generated from name"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-0.5">URL-friendly identifier</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!newOrgName.trim() || isPending}
              className="bg-[#00D2FF] text-[#00566a] hover:bg-[#00bce6]"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
