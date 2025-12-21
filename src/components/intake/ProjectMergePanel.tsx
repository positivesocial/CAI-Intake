"use client";

/**
 * CAI Intake - Project Merge Panel
 * 
 * Enhanced panel for managing and merging multi-page uploads with:
 * - Preview merged part list before confirming
 * - Duplicate detection across pages
 * - Same Project badge for matched files
 */

import * as React from "react";
import {
  Layers,
  FileStack,
  Merge,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  Eye,
  Copy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface DuplicateGroup {
  dimensions: string;
  partIds: string[];
  labels: string[];
}

/**
 * ProjectMergePanel - Shows unmerged project batches and allows merging
 * 
 * When users upload multiple pages/files with the same project code,
 * this panel appears to let them merge those batches together.
 */
export function ProjectMergePanel() {
  const { 
    getUnmergedProjects, 
    mergeProjectBatches, 
    currentCutlist 
  } = useIntakeStore();
  
  const unmergedProjects = getUnmergedProjects();
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(new Set());
  const [mergedProjects, setMergedProjects] = React.useState<Set<string>>(new Set());
  const [previewProject, setPreviewProject] = React.useState<string | null>(null);
  
  // Get parts for a project
  const getProjectParts = React.useCallback((projectCode: string) => {
    const project = unmergedProjects.find((p) => p.project_code === projectCode);
    if (!project) return [];
    
    const partIds = new Set(project.batches.flatMap((b) => b.part_ids));
    return currentCutlist.parts.filter((p) => partIds.has(p.part_id));
  }, [unmergedProjects, currentCutlist.parts]);

  // Detect duplicates (same dimensions)
  const detectDuplicates = React.useCallback((projectCode: string): DuplicateGroup[] => {
    const parts = getProjectParts(projectCode);
    const dimMap = new Map<string, { partIds: string[]; labels: string[] }>();
    
    for (const part of parts) {
      const key = `${part.size.L}x${part.size.W}x${part.thickness_mm}`;
      const existing = dimMap.get(key);
      if (existing) {
        existing.partIds.push(part.part_id);
        existing.labels.push(part.label || "Unnamed");
      } else {
        dimMap.set(key, {
          partIds: [part.part_id],
          labels: [part.label || "Unnamed"],
        });
      }
    }
    
    // Only return groups with duplicates
    return Array.from(dimMap.entries())
      .filter(([, group]) => group.partIds.length > 1)
      .map(([dimensions, group]) => ({
        dimensions,
        partIds: group.partIds,
        labels: group.labels,
      }));
  }, [getProjectParts]);
  
  if (unmergedProjects.length === 0) {
    return null;
  }
  
  const toggleExpanded = (projectCode: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectCode)) {
        next.delete(projectCode);
      } else {
        next.add(projectCode);
      }
      return next;
    });
  };
  
  const handleMerge = (projectCode: string) => {
    mergeProjectBatches(projectCode);
    setMergedProjects((prev) => new Set(prev).add(projectCode));
    setPreviewProject(null);
    
    // Remove from list after animation
    setTimeout(() => {
      setMergedProjects((prev) => {
        const next = new Set(prev);
        next.delete(projectCode);
        return next;
      });
    }, 1500);
  };
  
  const handleMergeAll = () => {
    unmergedProjects.forEach((p) => {
      mergeProjectBatches(p.project_code);
      setMergedProjects((prev) => new Set(prev).add(p.project_code));
    });
    setPreviewProject(null);
    
    setTimeout(() => {
      setMergedProjects(new Set());
    }, 1500);
  };

  const handlePreview = (projectCode: string) => {
    setPreviewProject(previewProject === projectCode ? null : projectCode);
  };
  
  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                Multi-Page Uploads Detected
              </CardTitle>
              <Badge variant="warning">{unmergedProjects.length} project{unmergedProjects.length !== 1 ? "s" : ""}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMergeAll}
              className="gap-2 border-amber-300 hover:bg-amber-100 dark:border-amber-700"
            >
              <Merge className="h-4 w-4" />
              Merge All
            </Button>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Parts from the same project are shown below. Preview before merging to check for duplicates.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-2">
          {unmergedProjects.map((project) => {
            const isExpanded = expandedProjects.has(project.project_code);
            const isMerged = mergedProjects.has(project.project_code);
            const isPreviewing = previewProject === project.project_code;
            const duplicates = detectDuplicates(project.project_code);
            
            return (
              <div
                key={project.project_code}
                className={cn(
                  "border rounded-lg overflow-hidden transition-all",
                  isMerged
                    ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                    : "border-amber-200 bg-white dark:border-amber-800/30 dark:bg-[var(--card)]"
                )}
              >
                {/* Project Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                  onClick={() => toggleExpanded(project.project_code)}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-[var(--muted-foreground)]">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Project: {project.project_code}</span>
                        {isMerged && (
                          <Badge variant="success" className="gap-1">
                            <Check className="h-3 w-3" />
                            Merged
                          </Badge>
                        )}
                        {duplicates.length > 0 && !isMerged && (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                            <Copy className="h-3 w-3" />
                            {duplicates.length} potential duplicate{duplicates.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        {project.batches.length} pages • {project.total_parts} parts total
                      </div>
                    </div>
                  </div>
                  
                  {!isMerged && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(project.project_code);
                        }}
                        className={cn(
                          "gap-1",
                          isPreviewing && "bg-amber-100 border-amber-300"
                        )}
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMerge(project.project_code);
                        }}
                        className="gap-2"
                      >
                        <Merge className="h-4 w-4" />
                        Merge
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Expanded Batch Details */}
                {isExpanded && (
                  <div className="border-t border-amber-200 dark:border-amber-800/30 px-3 py-2 space-y-1 bg-amber-50/30 dark:bg-amber-950/10">
                    {project.batches.map((batch) => (
                      <div
                        key={batch.batch_id}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <div className="flex items-center gap-2">
                          <FileStack className="h-4 w-4 text-amber-600" />
                          <span>
                            Page {batch.page_number}
                            {batch.total_pages && ` of ${batch.total_pages}`}
                          </span>
                          {batch.source_file && (
                            <span className="text-[var(--muted-foreground)] truncate max-w-[200px]">
                              — {batch.source_file}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {batch.part_ids.length} parts
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewProject && (
        <MergePreviewModal
          projectCode={previewProject}
          parts={getProjectParts(previewProject)}
          duplicates={detectDuplicates(previewProject)}
          onClose={() => setPreviewProject(null)}
          onMerge={() => handleMerge(previewProject)}
        />
      )}
    </>
  );
}

/**
 * Preview modal showing parts that will be merged
 */
interface MergePreviewModalProps {
  projectCode: string;
  parts: Array<{
    part_id: string;
    label?: string;
    size: { L: number; W: number };
    thickness_mm: number;
    qty: number;
    material_id: string;
  }>;
  duplicates: DuplicateGroup[];
  onClose: () => void;
  onMerge: () => void;
}

function MergePreviewModal({
  projectCode,
  parts,
  duplicates,
  onClose,
  onMerge,
}: MergePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-[var(--cai-teal)]" />
              <div>
                <CardTitle>Merge Preview: {projectCode}</CardTitle>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {parts.length} parts will be combined into one project
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Duplicate Warning */}
          {duplicates.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Potential Duplicates Detected
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    The following parts have identical dimensions across pages:
                  </p>
                  <div className="mt-2 space-y-1">
                    {duplicates.slice(0, 5).map((dup, i) => (
                      <div key={i} className="text-sm text-amber-700 dark:text-amber-300">
                        <span className="font-mono">{dup.dimensions}</span>
                        <span className="mx-1">—</span>
                        <span>{dup.labels.slice(0, 3).join(", ")}</span>
                        {dup.labels.length > 3 && (
                          <span className="opacity-75"> +{dup.labels.length - 3} more</span>
                        )}
                      </div>
                    ))}
                    {duplicates.length > 5 && (
                      <div className="text-sm text-amber-600">
                        +{duplicates.length - 5} more duplicate groups
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Parts Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">L × W × T</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium">Material</th>
                </tr>
              </thead>
              <tbody>
                {parts.slice(0, 30).map((part, i) => {
                  const isDuplicate = duplicates.some((d) =>
                    d.partIds.includes(part.part_id)
                  );
                  return (
                    <tr
                      key={part.part_id}
                      className={cn(
                        "border-t",
                        isDuplicate && "bg-amber-50 dark:bg-amber-950/20"
                      )}
                    >
                      <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {part.label || "Unnamed"}
                          {isDuplicate && (
                            <Copy className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {part.size.L} × {part.size.W} × {part.thickness_mm}
                      </td>
                      <td className="px-3 py-2">{part.qty}</td>
                      <td className="px-3 py-2 text-xs truncate max-w-[100px]">
                        {part.material_id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parts.length > 30 && (
              <div className="px-3 py-2 text-sm text-[var(--muted-foreground)] border-t bg-[var(--muted)]">
                +{parts.length - 30} more parts
              </div>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between bg-[var(--card)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            {duplicates.length > 0
              ? "Review duplicates before merging, or merge anyway to keep all parts."
              : "All parts look unique. Ready to merge!"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onMerge}
              className="gap-2 bg-[var(--cai-teal)] hover:bg-[var(--cai-teal)]/90"
            >
              <Merge className="h-4 w-4" />
              Merge {parts.length} Parts
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Compact version for showing in a smaller space
 */
export function ProjectMergeIndicator() {
  const { getUnmergedProjects, mergeProjectBatches } = useIntakeStore();
  const unmergedProjects = getUnmergedProjects();
  
  if (unmergedProjects.length === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-950/30 rounded-lg text-sm">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <span className="text-amber-800 dark:text-amber-200">
        {unmergedProjects.length} multi-page project{unmergedProjects.length !== 1 ? "s" : ""} to merge
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => unmergedProjects.forEach(p => mergeProjectBatches(p.project_code))}
        className="ml-auto h-7 text-amber-700 hover:text-amber-900 hover:bg-amber-200"
      >
        <Merge className="h-3 w-3 mr-1" />
        Merge All
      </Button>
    </div>
  );
}
