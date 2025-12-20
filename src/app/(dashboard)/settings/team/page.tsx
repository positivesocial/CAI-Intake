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
import { ROLES, ROLE_DISPLAY_NAMES, ROLE_DESCRIPTIONS } from "@/lib/auth/roles";
import type { RoleType } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

// Mock team members
const MOCK_TEAM_MEMBERS = [
  {
    id: "1",
    name: "John Manager",
    email: "john@workshop.com",
    role: "manager" as RoleType,
    status: "active",
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    avatar: null,
  },
  {
    id: "2",
    name: "Sarah Operator",
    email: "sarah@workshop.com",
    role: "operator" as RoleType,
    status: "active",
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
    avatar: null,
  },
  {
    id: "3",
    name: "Mike Viewer",
    email: "mike@workshop.com",
    role: "viewer" as RoleType,
    status: "inactive",
    lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    avatar: null,
  },
];

const MOCK_INVITATIONS = [
  {
    id: "1",
    email: "newuser@example.com",
    role: "operator" as RoleType,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "pending",
  },
];

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

function RoleBadge({ role }: { role: RoleType }) {
  const colors: Record<RoleType, string> = {
    super_admin: "bg-red-100 text-red-700",
    org_admin: "bg-purple-100 text-purple-700",
    manager: "bg-blue-100 text-blue-700",
    operator: "bg-green-100 text-green-700",
    viewer: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge className={cn("font-medium", colors[role])}>
      {ROLE_DISPLAY_NAMES[role]}
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

export default function TeamManagementPage() {
  const { user, isOrgAdmin, can } = useAuthStore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<RoleType>("operator");
  const [isSending, setIsSending] = React.useState(false);

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

  const handleInvite = async () => {
    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSending(false);
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("operator");
  };

  const filteredMembers = MOCK_TEAM_MEMBERS.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    onClick={() => setIsInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleInvite}
                    disabled={!inviteEmail || isSending}
                  >
                    {isSending ? (
                      "Sending..."
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
                  <p className="text-2xl font-bold">{MOCK_TEAM_MEMBERS.length}</p>
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
                  <p className="text-2xl font-bold">
                    {MOCK_TEAM_MEMBERS.filter((m) => m.status === "active").length}
                  </p>
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
                  <p className="text-2xl font-bold">{MOCK_INVITATIONS.length}</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="text-[var(--muted-foreground)]">
                      {formatDate(member.lastLogin)}
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
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {MOCK_INVITATIONS.length > 0 && (
          <Card>
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
                  {MOCK_INVITATIONS.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={invite.role} />
                      </TableCell>
                      <TableCell className="text-[var(--muted-foreground)]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {Math.ceil(
                            (invite.expiresAt.getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )}{" "}
                          days
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

