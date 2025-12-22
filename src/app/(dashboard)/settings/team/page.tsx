"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Shield,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  Send,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/lib/auth/store";
import { ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS } from "@/lib/auth/roles";
import type { RoleType } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  lastActive: string;
  cutlistsThisWeek: number;
  avatar?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  status: "pending" | "expired";
}

interface TeamStats {
  total: number;
  active: number;
  pendingInvites: number;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchTeamData(): Promise<{
  members: TeamMember[];
  invitations: Invitation[];
  stats: TeamStats;
}> {
  try {
    const response = await fetch("/api/v1/team");
    if (!response.ok) {
      throw new Error("Failed to fetch team data");
    }
    return response.json();
  } catch {
    return {
      members: [],
      invitations: [],
      stats: { total: 0, active: 0, pendingInvites: 0 },
    };
  }
}

async function sendInvitation(email: string, role: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/v1/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to send invitation" };
    }
    
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700",
    org_admin: "bg-purple-100 text-purple-700",
    manager: "bg-blue-100 text-blue-700",
    operator: "bg-green-100 text-green-700",
    viewer: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge className={cn("font-medium", colors[role] || "bg-gray-100")}>
      {ROLE_DISPLAY_NAMES[role as RoleType] || role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="h-3 w-3" />
      Inactive
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="h-8 w-48 bg-[var(--muted)] rounded animate-pulse" />
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-[var(--cai-teal)]" />
            <p className="text-[var(--muted-foreground)]">Loading team data...</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TeamManagementPage() {
  const { user, isOrgAdmin } = useAuthStore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<RoleType>("operator");
  const [isSending, setIsSending] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  
  const [loading, setLoading] = React.useState(true);
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [stats, setStats] = React.useState<TeamStats>({ total: 0, active: 0, pendingInvites: 0 });

  // Fetch data on mount
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await fetchTeamData();
      setMembers(data.members);
      setInvitations(data.invitations);
      setStats(data.stats);
      setLoading(false);
    }
    loadData();
  }, []);

  // Check permissions
  if (!isOrgAdmin()) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Users className="h-16 w-16 mx-auto text-[var(--muted-foreground)] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-[var(--muted-foreground)] mb-6">
              You don't have permission to manage team members.
            </p>
            <Link href="/settings">
              <Button variant="primary">Back to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  const handleInvite = async () => {
    setIsSending(true);
    setInviteError(null);
    
    const result = await sendInvitation(inviteEmail, inviteRole);
    
    if (result.success) {
      // Refresh data
      const data = await fetchTeamData();
      setMembers(data.members);
      setInvitations(data.invitations);
      setStats(data.stats);
      
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("operator");
    } else {
      setInviteError(result.error || "Failed to send invitation");
    }
    
    setIsSending(false);
  };

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingInvitations = invitations.filter(i => i.status === "pending");

  const formatExpiresIn = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days` : "Expired";
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Team Management</h1>
                <p className="text-[var(--muted-foreground)]">
                  Manage {user?.organization?.name} team members
                </p>
              </div>
            </div>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="primary">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join {user?.organization?.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {inviteError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {inviteError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Role</label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) => setInviteRole(v as RoleType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">
                          <div className="flex flex-col">
                            <span>Manager</span>
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {ROLE_DESCRIPTIONS.manager}
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="operator">
                          <div className="flex flex-col">
                            <span>Operator</span>
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {ROLE_DESCRIPTIONS.operator}
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex flex-col">
                            <span>Viewer</span>
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {ROLE_DESCRIPTIONS.viewer}
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsInviteDialogOpen(false);
                      setInviteError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleInvite}
                    disabled={!inviteEmail || isSending}
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Total Members
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Active Users
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pendingInvites}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Pending Invites
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members by name or email..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Members Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-[var(--muted-foreground)]">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No team members found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>This Week</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center">
                            <span className="font-medium text-[var(--muted-foreground)]">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={member.status} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{member.cutlistsThisWeek}</span>
                        <span className="text-[var(--muted-foreground)]"> cutlists</span>
                      </TableCell>
                      <TableCell className="text-[var(--muted-foreground)]">
                        {member.lastActive}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={invite.role} />
                      </TableCell>
                      <TableCell className="text-[var(--muted-foreground)]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatExpiresIn(invite.expiresAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm">
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Role Descriptions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["manager", "operator", "viewer"] as RoleType[]).map((role) => (
                <div key={role} className="p-4 rounded-lg bg-[var(--muted)]">
                  <RoleBadge role={role} />
                  <p className="text-sm text-[var(--muted-foreground)] mt-2">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
