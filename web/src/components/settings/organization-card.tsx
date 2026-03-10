"use client";

import { useState, useEffect, useTransition } from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import CheckIcon from "@mui/icons-material/Check";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { authClient } from "@/lib/auth-client";

type Org = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function OrganizationCard() {
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
    const slug = newOrgSlug.trim() || newOrgName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    startTransition(async () => {
      await authClient.organization.create({ name: newOrgName.trim(), slug });
      setCreateOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      fetchOrgs();
    });
  };

  return (
    <Card>
      <CardHeader
        title="Organization"
        titleTypographyProps={{ fontWeight: 600 }}
        action={
          <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setCreateOpen(true)}>
            Create
          </Button>
        }
      />
      <Divider />
      <CardContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary">Loading...</Typography>
          </Box>
        ) : (
          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton onClick={handleUsePersonal} selected={!activeOrg} disabled={isPending}>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Personal"
                  secondary="Use your individual library"
                />
                {!activeOrg && <CheckIcon color="success" />}
              </ListItemButton>
            </ListItem>
            <Divider />
            {orgs.map((org) => (
              <ListItem key={org.id} disablePadding>
                <ListItemButton
                  onClick={() => handleSetActive(org.id)}
                  selected={activeOrg?.id === org.id}
                  disabled={isPending}
                >
                  <ListItemIcon>
                    <GroupIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={org.name}
                    secondary={org.slug}
                  />
                  {activeOrg?.id === org.id && <CheckIcon color="success" />}
                </ListItemButton>
              </ListItem>
            ))}
            {orgs.length === 0 && (
              <ListItem>
                <ListItemText
                  secondary="No organizations yet. Create one to share your library with team members."
                  sx={{ textAlign: "center", py: 2 }}
                />
              </ListItem>
            )}
          </List>
        )}
      </CardContent>

      {/* Create Org Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Organization</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Organizations let multiple users share scan stations, spools, and inventory.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Organization Name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Slug (optional)"
            placeholder="auto-generated from name"
            value={newOrgSlug}
            onChange={(e) => setNewOrgSlug(e.target.value)}
            helperText="URL-friendly identifier"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newOrgName.trim() || isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
