import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RoleBadge } from "@/components/status-badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Mail, Phone } from "lucide-react";

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "", phone: "", role: "field_tech" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", form);
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Full Name *</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Role *</Label>
          <Select value={form.role} onValueChange={v => set("role", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="field_tech">Field Tech</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Username *</Label>
          <Input value={form.username} onChange={e => set("username", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Password *</Label>
          <Input type="password" value={form.password} onChange={e => set("password", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Email *</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} className="mt-1" required />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} className="mt-1" />
        </div>
      </div>
      <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create User"}
      </Button>
    </div>
  );
}

export default function AdminUsers() {
  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, { active: !active });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
  });

  return (
    <AppLayout
      title="Staff & Users"
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
            <AddUserDialog onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="p-4 max-w-3xl mx-auto space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : !users?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No users found</p>
          </div>
        ) : (
          users.map(user => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{user.name}</p>
                        <RoleBadge role={user.role} />
                        {!user.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {user.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>}
                        {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleActive.mutate({ id: user.id, active: user.active })}
                    data-testid={`button-toggle-user-${user.id}`}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
