"use client";

import * as React from "react";
import {
  Layers,
  FileStack,
  Merge,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntakeStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * ProjectMergePanel - Shows unmerged project batches and allows merging
 * 
 * When users upload multiple pages/files with the same project code,
 * this panel appears to let them merge those batches together.
 */
export function ProjectMergePanel() {
  const { getUnmergedProjects, mergeProjectBatches } = useIntakeStore();
  
  const unmergedProjects = getUnmergedProjects();
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(new Set());
  const [mergedProjects, setMergedProjects] = React.useState<Set<string>>(new Set());
  
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
    
    setTimeout(() => {
      setMergedProjects(new Set());
    }, 1500);
  };
  
  return (
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
          Parts from the same project are shown below. Merge to combine them into a single list.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {unmergedProjects.map((project) => {
          const isExpanded = expandedProjects.has(project.project_code);
          const isMerged = mergedProjects.has(project.project_code);
          
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
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {project.batches.length} pages • {project.total_parts} parts total
                    </div>
                  </div>
                </div>
                
                {!isMerged && (
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



