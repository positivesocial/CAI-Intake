/**
 * CAI Intake - Correction Recording & Analysis
 * 
 * Record user corrections and analyze them for pattern extraction.
 */

import { getClient } from "@/lib/supabase/client";
import type { 
  ParseCorrection, 
  CorrectionType, 
  CorrectionAnalysis,
  PatternType,
} from "./types";
import { upsertPattern } from "./patterns";
import { upsertMaterialMapping, normalizeMaterialName } from "./materials";
import type { CutPart } from "@/lib/schema";

// ============================================================
// CORRECTION RECORDING
// ============================================================

/**
 * Record a user correction
 */
export async function recordCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">
): Promise<ParseCorrection | null> {
  const supabase = getClient();
  if (!supabase) {
    console.warn("Cannot record correction: Supabase not available");
    return null;
  }

  try {
    // Use any to bypass type checking since the table may not be in the generated types yet
    const insertData = {
      organization_id: correction.organizationId,
      user_id: correction.userId,
      parse_job_id: correction.parseJobId,
      cutlist_id: correction.cutlistId,
      correction_type: correction.correctionType,
      field_path: correction.fieldPath,
      original_value: correction.originalValue,
      corrected_value: correction.correctedValue,
      original_part: correction.originalPart,
      corrected_part: correction.correctedPart,
      source_text: correction.sourceText,
      source_line_number: correction.sourceLineNumber,
      source_file_name: correction.sourceFileName,
      pattern_extracted: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("parse_corrections")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Analyze and potentially learn from the correction
    const analysis = analyzeCorrection(correction);
    if (analysis.autoLearn) {
      await learnFromCorrection(correction, analysis);
      
      // Mark as pattern extracted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("parse_corrections")
        .update({ pattern_extracted: true })
        .eq("id", data.id);
    }

    return mapDbCorrectionToCorrection(data);
  } catch (error) {
    console.error("Failed to record correction:", error);
    return null;
  }
}

/**
 * Record multiple corrections at once
 */
export async function recordCorrections(
  corrections: Omit<ParseCorrection, "id" | "createdAt">[]
): Promise<number> {
  let recorded = 0;
  
  for (const correction of corrections) {
    const result = await recordCorrection(correction);
    if (result) recorded++;
  }
  
  return recorded;
}

// ============================================================
// CORRECTION ANALYSIS
// ============================================================

/**
 * Analyze a correction to extract patterns
 */
export function analyzeCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">
): CorrectionAnalysis {
  const analysis: CorrectionAnalysis = {
    correctionType: correction.correctionType,
    patternDetected: false,
    confidence: 0.5,
    autoLearn: false,
  };

  switch (correction.correctionType) {
    case "material":
      analyzeMaterialCorrection(correction, analysis);
      break;
    case "edge_banding":
      analyzeEdgeBandingCorrection(correction, analysis);
      break;
    case "groove":
      analyzeGrooveCorrection(correction, analysis);
      break;
    case "dimension":
      analyzeDimensionCorrection(correction, analysis);
      break;
    case "quantity":
      analyzeQuantityCorrection(correction, analysis);
      break;
  }

  return analysis;
}

function analyzeMaterialCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): void {
  const originalMaterial = correction.originalValue as string | undefined;
  const correctedMaterial = correction.correctedValue as string;
  const sourceText = correction.sourceText;
  
  if (!correctedMaterial) return;

  // Try to find the raw material name in source text
  let rawName = originalMaterial;
  
  if (sourceText) {
    // Look for material-related words in source
    const materialPatterns = [
      /material[:\s]+([^\n,;]+)/i,
      /board[:\s]+([^\n,;]+)/i,
      /(pb|mdf|ply|melamine|particleboard)\s+\w+/i,
    ];
    
    for (const pattern of materialPatterns) {
      const match = sourceText.match(pattern);
      if (match) {
        rawName = match[1] || match[0];
        break;
      }
    }
  }
  
  if (rawName && rawName !== correctedMaterial) {
    analysis.patternDetected = true;
    analysis.extractedMaterialMapping = {
      rawName: rawName.trim(),
      materialId: correctedMaterial,
    };
    analysis.confidence = 0.7;
    analysis.autoLearn = true;
  }
}

function analyzeEdgeBandingCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): void {
  const sourceText = correction.sourceText;
  if (!sourceText) return;

  const correctedEdges = correction.correctedValue as string[] | undefined;
  if (!correctedEdges || correctedEdges.length === 0) return;

  // Look for edge notation patterns in source text
  const edgePatterns = [
    { pattern: /\bX\b/g, expected: ["L1"] },
    { pattern: /\bXX\b/g, expected: ["W1", "W2"] },
    { pattern: /\b4L\b/gi, expected: ["L1", "L2", "W1", "W2"] },
    { pattern: /\b2L\b/gi, expected: ["L1", "L2"] },
    { pattern: /\b2W\b/gi, expected: ["W1", "W2"] },
  ];

  for (const { pattern, expected } of edgePatterns) {
    if (pattern.test(sourceText)) {
      // Check if the correction matches what we'd expect
      const matches = correctedEdges.filter(e => expected.includes(e)).length;
      if (matches > 0 && matches !== expected.length) {
        // User corrected our expected interpretation - learn new pattern
        analysis.patternDetected = true;
        analysis.extractedPattern = {
          type: "edge_notation",
          inputPattern: pattern.source.replace(/\\b/g, ""),
          outputMapping: { edges: correctedEdges },
        };
        analysis.confidence = 0.6;
        analysis.autoLearn = true;
        return;
      }
    }
  }
}

function analyzeGrooveCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): void {
  const sourceText = correction.sourceText;
  if (!sourceText) return;

  const correctedGroove = correction.correctedValue as string | undefined;
  if (!correctedGroove) return;

  // Look for groove notation patterns
  if (/\bx\b/.test(sourceText)) {
    analysis.patternDetected = true;
    analysis.extractedPattern = {
      type: "groove_notation",
      inputPattern: "x",
      outputMapping: { groove: correctedGroove },
    };
    analysis.confidence = 0.65;
    analysis.autoLearn = true;
  }
}

function analyzeDimensionCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): void {
  // Dimension corrections are complex - usually indicate column order issues
  // Mark for potential template learning but don't auto-learn
  analysis.patternDetected = false;
  analysis.confidence = 0.4;
  analysis.autoLearn = false;
}

function analyzeQuantityCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): void {
  const sourceText = correction.sourceText;
  if (!sourceText) return;

  const correctedQty = correction.correctedValue as number | undefined;
  if (!correctedQty) return;

  // Look for quantity patterns that might have been missed
  const qtyPatterns = [
    { pattern: /x(\d+)/i, type: "prefix" },
    { pattern: /(\d+)\s*pcs/i, type: "suffix" },
    { pattern: /qty[:\s]*(\d+)/i, type: "label" },
  ];

  for (const { pattern, type } of qtyPatterns) {
    const match = sourceText.match(pattern);
    if (match && parseInt(match[1], 10) === correctedQty) {
      analysis.patternDetected = true;
      analysis.extractedPattern = {
        type: "quantity_format",
        inputPattern: pattern.source,
        outputMapping: type === "prefix" ? { prefix: "x" } : { suffix: "pcs" },
      };
      analysis.confidence = 0.7;
      analysis.autoLearn = true;
      return;
    }
  }
}

// ============================================================
// LEARNING FROM CORRECTIONS
// ============================================================

/**
 * Apply learning from an analyzed correction
 */
async function learnFromCorrection(
  correction: Omit<ParseCorrection, "id" | "createdAt">,
  analysis: CorrectionAnalysis
): Promise<void> {
  // Learn material mapping
  if (analysis.extractedMaterialMapping) {
    await upsertMaterialMapping(
      analysis.extractedMaterialMapping,
      correction.organizationId
    );
  }

  // Learn parser pattern
  if (analysis.extractedPattern) {
    await upsertPattern(
      {
        organizationId: correction.organizationId || null,
        patternType: analysis.extractedPattern.type as PatternType,
        inputPattern: analysis.extractedPattern.inputPattern,
        outputMapping: analysis.extractedPattern.outputMapping,
        confidence: analysis.confidence,
      },
      correction.organizationId
    );
  }
}

// ============================================================
// CORRECTION DETECTION
// ============================================================

/**
 * Detect what corrections were made between original and corrected parts
 */
export function detectCorrections(
  originalPart: Partial<CutPart>,
  correctedPart: CutPart,
  sourceText?: string
): Omit<ParseCorrection, "id" | "createdAt" | "organizationId" | "userId">[] {
  const corrections: Omit<ParseCorrection, "id" | "createdAt" | "organizationId" | "userId">[] = [];

  // Check dimensions
  if (originalPart.size?.L !== correctedPart.size.L || 
      originalPart.size?.W !== correctedPart.size.W) {
    corrections.push({
      correctionType: "dimension",
      fieldPath: "size",
      originalValue: originalPart.size,
      correctedValue: correctedPart.size,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check thickness
  if (originalPart.thickness_mm !== correctedPart.thickness_mm) {
    corrections.push({
      correctionType: "dimension",
      fieldPath: "thickness_mm",
      originalValue: originalPart.thickness_mm,
      correctedValue: correctedPart.thickness_mm,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check quantity
  if (originalPart.qty !== correctedPart.qty) {
    corrections.push({
      correctionType: "quantity",
      fieldPath: "qty",
      originalValue: originalPart.qty,
      correctedValue: correctedPart.qty,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check material
  if (originalPart.material_id !== correctedPart.material_id) {
    corrections.push({
      correctionType: "material",
      fieldPath: "material_id",
      originalValue: originalPart.material_id,
      correctedValue: correctedPart.material_id,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check label
  if (originalPart.label !== correctedPart.label) {
    corrections.push({
      correctionType: "label",
      fieldPath: "label",
      originalValue: originalPart.label,
      correctedValue: correctedPart.label,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check edge banding
  const originalEdges = originalPart.ops?.edging?.edges;
  const correctedEdges = correctedPart.ops?.edging?.edges;
  if (JSON.stringify(originalEdges) !== JSON.stringify(correctedEdges)) {
    corrections.push({
      correctionType: "edge_banding",
      fieldPath: "ops.edging.edges",
      originalValue: originalEdges,
      correctedValue: correctedEdges,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check grooves
  const originalGrooves = originalPart.ops?.grooves;
  const correctedGrooves = correctedPart.ops?.grooves;
  if (JSON.stringify(originalGrooves) !== JSON.stringify(correctedGrooves)) {
    corrections.push({
      correctionType: "groove",
      fieldPath: "ops.grooves",
      originalValue: originalGrooves,
      correctedValue: correctedGrooves,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check rotation
  if (originalPart.allow_rotation !== correctedPart.allow_rotation) {
    corrections.push({
      correctionType: "rotation",
      fieldPath: "allow_rotation",
      originalValue: originalPart.allow_rotation,
      correctedValue: correctedPart.allow_rotation,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  // Check grain
  if (originalPart.grain !== correctedPart.grain) {
    corrections.push({
      correctionType: "grain",
      fieldPath: "grain",
      originalValue: originalPart.grain,
      correctedValue: correctedPart.grain,
      originalPart,
      correctedPart,
      sourceText,
    });
  }

  return corrections;
}

// ============================================================
// HELPERS
// ============================================================

function mapDbCorrectionToCorrection(data: Record<string, unknown>): ParseCorrection {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | undefined,
    userId: data.user_id as string | undefined,
    parseJobId: data.parse_job_id as string | undefined,
    cutlistId: data.cutlist_id as string | undefined,
    correctionType: data.correction_type as CorrectionType,
    fieldPath: data.field_path as string | undefined,
    originalValue: data.original_value,
    correctedValue: data.corrected_value,
    originalPart: data.original_part as Partial<CutPart> | undefined,
    correctedPart: data.corrected_part as Partial<CutPart> | undefined,
    sourceText: data.source_text as string | undefined,
    sourceLineNumber: data.source_line_number as number | undefined,
    sourceFileName: data.source_file_name as string | undefined,
    patternExtracted: data.pattern_extracted as boolean,
    patternId: data.pattern_id as string | undefined,
    createdAt: data.created_at ? new Date(data.created_at as string) : undefined,
  };
}
