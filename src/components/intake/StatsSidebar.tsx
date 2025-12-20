"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Ruler,
  Scissors,
  Drill,
  FileText,
  AlertTriangle,
  Package,
  Activity,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIntakeStore } from "@/lib/store";
import { calculateStatistics, formatArea, formatLength, type CutlistStatistics } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface StatsSidebarProps {
  className?: string;
}

export function StatsSidebar({ className }: StatsSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [stats, setStats] = React.useState<CutlistStatistics | null>(null);
  
  const parts = useIntakeStore((state) => state.currentCutlist.parts);
  const inboxParts = useIntakeStore((state) => state.inboxParts);
  const materials = useIntakeStore((state) => state.currentCutlist.materials);
  const edgebands = useIntakeStore((state) => state.currentCutlist.edgebands);
  
  // Recalculate statistics when parts change
  React.useEffect(() => {
    const allParts = [...parts, ...inboxParts.filter(p => p._status !== "rejected")];
    if (allParts.length > 0) {
      const newStats = calculateStatistics(allParts, materials, edgebands);
      setStats(newStats);
    } else {
      setStats(null);
    }
  }, [parts, inboxParts, materials, edgebands]);

  if (isCollapsed) {
    return (
      <div className={cn("w-12 h-full border-l border-[var(--border)] bg-[var(--card)] flex flex-col items-center py-4", className)}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsCollapsed(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {stats && (
          <div className="mt-4 flex flex-col items-center gap-3 text-[var(--muted-foreground)]">
            <div className="flex flex-col items-center" title={`${stats.totals.uniqueParts} parts`}>
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium mt-1">{stats.totals.totalPieces}</span>
            </div>
            <div className="flex flex-col items-center" title={`${stats.materials.length} materials`}>
              <Layers className="h-4 w-4" />
              <span className="text-xs font-medium mt-1">{stats.materials.length}</span>
            </div>
            {stats.totals.partsWithEdging > 0 && (
              <div className="flex flex-col items-center" title="Has edging">
                <Ruler className="h-4 w-4 text-[var(--cai-teal)]" />
              </div>
            )}
            {stats.totals.partsWithCNC > 0 && (
              <div className="flex flex-col items-center" title="Has CNC ops">
                <Drill className="h-4 w-4 text-[var(--cai-gold)]" />
              </div>
            )}
            {stats.totals.partsNeedingReview > 0 && (
              <div className="flex flex-col items-center" title={`${stats.totals.partsNeedingReview} need review`}>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-80 h-full border-l border-[var(--border)] bg-[var(--card)] flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--cai-teal)]" />
          <span className="text-sm font-semibold">Statistics</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsCollapsed(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!stats ? (
          <div className="text-center text-sm text-[var(--muted-foreground)] py-8">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No parts yet</p>
            <p className="text-xs mt-1">Add parts to see statistics</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="Unique Parts"
                  value={stats.totals.uniqueParts}
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="Total Pieces"
                  value={stats.totals.totalPieces}
                />
                <StatCard
                  icon={<Activity className="h-4 w-4" />}
                  label="Total Area"
                  value={`${stats.totals.totalAreaSqm.toFixed(2)} m²`}
                  className="col-span-2"
                />
              </div>
            </section>

            {/* Materials */}
            <section>
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                Materials ({stats.materials.length})
              </h3>
              <div className="space-y-2">
                {stats.materials.map((mat) => (
                  <div
                    key={mat.materialId}
                    className="bg-[var(--muted)] rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{mat.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {mat.thickness}mm
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                      <div>
                        <span className="block text-[var(--foreground)] font-medium">
                          {mat.totalPieces} pcs
                        </span>
                        <span>{mat.uniqueParts} unique</span>
                      </div>
                      <div>
                        <span className="block text-[var(--foreground)] font-medium">
                          {mat.totalAreaSqm.toFixed(2)} m²
                        </span>
                        {mat.theoreticalSheets > 0 && (
                          <span>≥{mat.theoreticalSheets} sheets</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Edge Banding */}
            {stats.edgeBanding.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Ruler className="h-3 w-3" />
                  Edge Banding
                </h3>
                <div className="space-y-2">
                  {stats.edgeBanding.map((eb) => (
                    <div
                      key={eb.edgebandId}
                      className="flex items-center justify-between py-2 px-3 bg-[var(--muted)] rounded-lg"
                    >
                      <div>
                        <span className="text-sm font-medium">{eb.name}</span>
                        <span className="text-xs text-[var(--muted-foreground)] ml-2">
                          ({eb.edgeCount} edges)
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--cai-teal)]">
                        {eb.totalLengthM.toFixed(1)} m
                      </span>
                    </div>
                  ))}
                  <div className="text-xs text-[var(--muted-foreground)] pt-1">
                    Total: {stats.edgeBanding.reduce((sum, eb) => sum + eb.totalLengthM, 0).toFixed(1)} m 
                    ({stats.totals.partsWithEdging} parts)
                  </div>
                </div>
              </section>
            )}

            {/* Grooving */}
            {stats.grooving.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Scissors className="h-3 w-3" />
                  Grooving
                </h3>
                <div className="space-y-2">
                  {stats.grooving.map((grv) => (
                    <div
                      key={grv.profileId}
                      className="flex items-center justify-between py-2 px-3 bg-[var(--muted)] rounded-lg"
                    >
                      <div>
                        <span className="text-sm font-medium">{grv.profileId}</span>
                        <span className="text-xs text-[var(--muted-foreground)] ml-2">
                          ({grv.grooveCount} grooves)
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {grv.totalLengthM.toFixed(1)} m
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CNC Operations */}
            {stats.totals.partsWithCNC > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Drill className="h-3 w-3" />
                  CNC Operations
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {stats.cncOperations.holes.count > 0 && (
                    <div className="bg-[var(--muted)] rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-[var(--cai-gold)]">
                        {stats.cncOperations.holes.count}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">Holes</div>
                    </div>
                  )}
                  {stats.cncOperations.routing.count > 0 && (
                    <div className="bg-[var(--muted)] rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-[var(--cai-teal)]">
                        {stats.cncOperations.routing.count}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">Routes</div>
                    </div>
                  )}
                  {stats.cncOperations.customOps.count > 0 && (
                    <div className="bg-[var(--muted)] rounded-lg p-2 text-center">
                      <div className="text-lg font-bold">
                        {stats.cncOperations.customOps.count}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">Custom</div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-2">
                  {stats.totals.partsWithCNC} parts require CNC
                </div>
              </section>
            )}

            {/* Orientation */}
            {stats.totals.partsWithGrain > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <RotateCcw className="h-3 w-3" />
                  Orientation
                </h3>
                <div className="flex items-center justify-between py-2 px-3 bg-[var(--muted)] rounded-lg">
                  <span className="text-sm">Fixed orientation</span>
                  <Badge variant="outline">{stats.totals.partsWithGrain} parts</Badge>
                </div>
                <div className="flex items-center justify-between py-2 px-3">
                  <span className="text-sm text-[var(--muted-foreground)]">Can rotate</span>
                  <span className="text-sm">{stats.totals.uniqueParts - stats.totals.partsWithGrain} parts</span>
                </div>
              </section>
            )}

            {/* Notes & Review */}
            {(stats.totals.partsWithNotes > 0 || stats.totals.partsNeedingReview > 0) && (
              <section>
                <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Notes & Review
                </h3>
                <div className="space-y-2">
                  {stats.totals.partsWithNotes > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-[var(--muted)] rounded-lg">
                      <span className="text-sm">With operator notes</span>
                      <Badge variant="outline">{stats.totals.partsWithNotes}</Badge>
                    </div>
                  )}
                  {stats.totals.partsNeedingReview > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Needs review</span>
                      </div>
                      <Badge variant="error">{stats.totals.partsNeedingReview}</Badge>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {stats && (
        <div className="px-4 py-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] shrink-0">
          Updated: {new Date(stats.calculatedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("bg-[var(--muted)] rounded-lg p-3", className)}>
      <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

