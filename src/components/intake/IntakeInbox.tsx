"use client";

import * as React from "react";
import {
  Check,
  X,
  Edit2,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIntakeStore, type ParsedPartWithStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null;

  const percent = Math.round(confidence * 100);

  let variant: "success" | "warning" | "error" = "success";
  let Icon = CheckCircle2;

  if (percent < 70) {
    variant = "error";
    Icon = XCircle;
  } else if (percent < 90) {
    variant = "warning";
    Icon = AlertTriangle;
  }

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {percent}%
    </Badge>
  );
}

function PartPreviewSvg({
  L,
  W,
  grain,
  edging,
}: {
  L: number;
  W: number;
  grain?: string;
  edging?: Record<string, { apply?: boolean }>;
}) {
  // Scale to fit in 80x60 box
  const maxW = 80;
  const maxH = 60;
  const scale = Math.min(maxW / L, maxH / W) * 0.8;
  const scaledL = L * scale;
  const scaledW = W * scale;
  const x = (maxW - scaledL) / 2;
  const y = (maxH - scaledW) / 2;

  return (
    <svg width={maxW} height={maxH} className="rounded bg-[var(--muted)]">
      {/* Part rectangle */}
      <rect
        x={x}
        y={y}
        width={scaledL}
        height={scaledW}
        className="fill-[var(--card)] stroke-[var(--foreground)]"
        strokeWidth="1.5"
      />

      {/* Grain lines */}
      {grain === "along_L" && (
        <>
          <line
            x1={x + 5}
            y1={y + scaledW / 3}
            x2={x + scaledL - 5}
            y2={y + scaledW / 3}
            className="stroke-[var(--muted-foreground)]"
            strokeWidth="0.5"
            strokeDasharray="4 2"
          />
          <line
            x1={x + 5}
            y1={y + (2 * scaledW) / 3}
            x2={x + scaledL - 5}
            y2={y + (2 * scaledW) / 3}
            className="stroke-[var(--muted-foreground)]"
            strokeWidth="0.5"
            strokeDasharray="4 2"
          />
        </>
      )}

      {/* Edge banding indicators */}
      {edging?.L1?.apply && (
        <line
          x1={x}
          y1={y + scaledW}
          x2={x + scaledL}
          y2={y + scaledW}
          className="stroke-[var(--cai-teal)]"
          strokeWidth="3"
        />
      )}
      {edging?.L2?.apply && (
        <line
          x1={x}
          y1={y}
          x2={x + scaledL}
          y2={y}
          className="stroke-[var(--cai-teal)]"
          strokeWidth="3"
        />
      )}
      {edging?.W1?.apply && (
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={y + scaledW}
          className="stroke-[var(--cai-teal)]"
          strokeWidth="3"
        />
      )}
      {edging?.W2?.apply && (
        <line
          x1={x + scaledL}
          y1={y}
          x2={x + scaledL}
          y2={y + scaledW}
          className="stroke-[var(--cai-teal)]"
          strokeWidth="3"
        />
      )}
    </svg>
  );
}

export function IntakeInbox() {
  const {
    inboxParts,
    acceptInboxPart,
    acceptAllInboxParts,
    rejectInboxPart,
    clearInbox,
  } = useIntakeStore();

  const pendingParts = inboxParts.filter((p) => p._status !== "rejected");
  const rejectedParts = inboxParts.filter((p) => p._status === "rejected");

  if (inboxParts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-medium mb-1">Intake Inbox Empty</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
              Parse text, import files, or dictate parts to add them here for
              review before adding to your cutlist.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Intake Inbox</CardTitle>
            <Badge variant="secondary">{pendingParts.length} pending</Badge>
            {rejectedParts.length > 0 && (
              <Badge variant="error">{rejectedParts.length} rejected</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearInbox}>
              Clear All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={acceptAllInboxParts}
              disabled={pendingParts.length === 0}
            >
              <Check className="h-4 w-4" />
              Accept All ({pendingParts.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Preview</TableHead>
                <TableHead>Part</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">L × W</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboxParts.map((part) => (
                <TableRow
                  key={part.part_id}
                  className={cn(
                    part._status === "rejected" && "opacity-50 bg-red-50/50"
                  )}
                >
                  <TableCell>
                    <PartPreviewSvg
                      L={part.size.L}
                      W={part.size.W}
                      grain={part.grain}
                      edging={part.ops?.edging?.edges as Record<string, { apply?: boolean }>}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {part.label || part.part_id}
                      </p>
                      {part._originalText && (
                        <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[200px]">
                          {part._originalText}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {part.qty}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {part.size.L} × {part.size.W}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{part.material_id}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <ConfidenceBadge confidence={part.audit?.confidence} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {part._status !== "rejected" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => acceptInboxPart(part.part_id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => rejectInboxPart(part.part_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="error" className="text-xs">
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

