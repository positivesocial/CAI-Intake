/**
 * CAI Intake - Client Template Learning
 * 
 * Learn and detect client-specific parsing templates.
 */

import { getClient } from "@/lib/supabase/client";
import type { ClientTemplate } from "./types";

// ============================================================
// TEMPLATE RETRIEVAL
// ============================================================

/**
 * Get all client templates for an organization
 */
export async function getClientTemplates(
  organizationId?: string
): Promise<ClientTemplate[]> {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("client_templates")
      .select("*")
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("usage_count", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDbTemplateToTemplate);
  } catch (error) {
    console.error("Failed to fetch client templates:", error);
    return [];
  }
}

/**
 * Find a template by client name or alias
 */
export async function findClientTemplate(
  clientHint: string,
  organizationId?: string
): Promise<ClientTemplate | null> {
  const normalized = clientHint.toLowerCase().trim();
  
  const supabase = getClient();
  if (!supabase) return null;

  try {
    // First try exact match on client_name
    let { data, error } = await supabase
      .from("client_templates")
      .select("*")
      .ilike("client_name", normalized)
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order("confidence", { ascending: false })
      .limit(1)
      .single();

    if (!data && !error) {
      // Try alias match
      const result = await supabase
        .from("client_templates")
        .select("*")
        .contains("client_aliases", [normalized])
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .order("confidence", { ascending: false })
        .limit(1)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error && error.code !== "PGRST116") throw error;

    return data ? mapDbTemplateToTemplate(data) : null;
  } catch (error) {
    console.error("Failed to find client template:", error);
    return null;
  }
}

// ============================================================
// TEMPLATE DETECTION
// ============================================================

/**
 * Detect client template from text content
 */
export async function detectClientTemplate(
  text: string,
  organizationId?: string
): Promise<ClientTemplate | null> {
  const templates = await getClientTemplates(organizationId);
  
  for (const template of templates) {
    // Check header patterns
    for (const pattern of template.headerPatterns) {
      const regex = new RegExp(pattern, "i");
      if (regex.test(text)) {
        return template;
      }
    }
    
    // Check client name in text
    if (text.toLowerCase().includes(template.clientName.toLowerCase())) {
      return template;
    }
    
    // Check aliases
    for (const alias of template.clientAliases) {
      if (text.toLowerCase().includes(alias.toLowerCase())) {
        return template;
      }
    }
  }
  
  return null;
}

/**
 * Detect column order from header row
 */
export function detectColumnOrder(
  headerRow: string[]
): string[] {
  const columnOrder: string[] = [];
  const headerMap: Record<string, string> = {
    // Label variants
    "label": "label",
    "name": "label",
    "part": "label",
    "component": "label",
    "description": "label",
    "desc": "label",
    
    // Dimension variants
    "length": "length",
    "l": "length",
    "l/h": "length",
    "height": "length",
    "h": "length",
    
    "width": "width",
    "w": "width",
    "w/b": "width",
    "breadth": "width",
    "b": "width",
    
    "thickness": "thickness",
    "t": "thickness",
    "thk": "thickness",
    
    // Quantity variants
    "qty": "qty",
    "quantity": "qty",
    "pcs": "qty",
    "pieces": "qty",
    "no": "qty",
    "count": "qty",
    
    // Edge variants
    "edge": "edge",
    "edging": "edge",
    "eb": "edge",
    "edgeband": "edge",
    "edge l": "edge_L",
    "edge w": "edge_W",
    
    // Groove variants
    "groove": "groove",
    "grv": "groove",
    
    // Material variants
    "material": "material",
    "mat": "material",
    "board": "material",
    
    // Notes variants
    "notes": "notes",
    "remarks": "notes",
    "comment": "notes",
  };
  
  for (const header of headerRow) {
    const normalized = header.toLowerCase().trim();
    const mapped = headerMap[normalized];
    
    if (mapped) {
      columnOrder.push(mapped);
    } else {
      // Try partial match
      for (const [key, value] of Object.entries(headerMap)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          columnOrder.push(value);
          break;
        }
      }
    }
  }
  
  return columnOrder;
}

// ============================================================
// TEMPLATE CREATION & UPDATE
// ============================================================

/**
 * Create or update a client template
 */
export async function upsertClientTemplate(
  template: Omit<ClientTemplate, "id" | "usageCount" | "successRate" | "lastUsedAt" | "organizationId">,
  organizationId?: string
): Promise<ClientTemplate | null> {
  const supabase = getClient();
  if (!supabase) return null;

  try {
    const insertData = {
      organization_id: organizationId,
      client_name: template.clientName,
      client_aliases: template.clientAliases,
      column_order: template.columnOrder,
      edge_notation: template.edgeNotation,
      groove_notation: template.grooveNotation,
      default_material_id: template.defaultMaterialId,
      default_thickness_mm: template.defaultThicknessMm,
      header_patterns: template.headerPatterns,
      sample_rows: template.sampleRows,
      notes: template.notes,
      confidence: template.confidence,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("client_templates")
      .upsert(insertData, {
        onConflict: "organization_id,client_name",
      })
      .select()
      .single();

    if (error) throw error;

    return mapDbTemplateToTemplate(data);
  } catch (error) {
    console.error("Failed to upsert client template:", error);
    return null;
  }
}

/**
 * Record template usage
 */
export async function recordTemplateUsage(
  templateId: string,
  success: boolean
): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("client_templates")
      .select("usage_count, success_rate")
      .eq("id", templateId)
      .single();

    if (current) {
      const typedCurrent = current as Record<string, number>;
      const newUsageCount = (typedCurrent.usage_count || 0) + 1;
      const oldSuccessRate = typedCurrent.success_rate || 0.5;
      // Exponential moving average of success rate
      const newSuccessRate = success 
        ? oldSuccessRate * 0.9 + 0.1
        : oldSuccessRate * 0.9;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("client_templates")
        .update({
          usage_count: newUsageCount,
          success_rate: newSuccessRate,
          confidence: Math.min(0.99, 0.5 + (newUsageCount * 0.01) + (newSuccessRate * 0.3)),
          last_used_at: new Date().toISOString(),
        })
        .eq("id", templateId);
    }
  } catch (error) {
    console.error("Failed to record template usage:", error);
  }
}

// ============================================================
// TEMPLATE APPLICATION
// ============================================================

/**
 * Parse a row using a client template's column order
 */
export function parseRowWithTemplate(
  row: string[],
  template: ClientTemplate
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (let i = 0; i < Math.min(row.length, template.columnOrder.length); i++) {
    const columnName = template.columnOrder[i];
    const value = row[i]?.trim();
    
    if (!value) continue;
    
    switch (columnName) {
      case "label":
        result.label = value;
        break;
      case "length":
        result.L = parseFloat(value) || undefined;
        break;
      case "width":
        result.W = parseFloat(value) || undefined;
        break;
      case "thickness":
        result.thickness = parseFloat(value) || undefined;
        break;
      case "qty":
        result.qty = parseInt(value, 10) || 1;
        break;
      case "material":
        result.material = value;
        break;
      case "edge":
      case "edge_L":
      case "edge_W":
        result[columnName] = parseEdgeNotation(value, template);
        break;
      case "groove":
        result.groove = parseGrooveNotation(value, template);
        break;
      case "notes":
        result.notes = value;
        break;
      default:
        // Store unknown columns for potential future use
        result[columnName] = value;
    }
  }
  
  return result;
}

/**
 * Parse edge notation using template's mappings
 */
function parseEdgeNotation(
  value: string,
  template: ClientTemplate
): string[] {
  const edges: string[] = [];
  
  if (!template.edgeNotation) {
    // Fallback to common patterns
    if (value === "X" || value === "x") edges.push("L1");
    if (value === "XX" || value === "xx") edges.push("W1", "W2");
    return edges;
  }
  
  for (const [notation, mappedEdges] of Object.entries(template.edgeNotation)) {
    if (value.includes(notation)) {
      edges.push(...mappedEdges);
    }
  }
  
  return [...new Set(edges)];
}

/**
 * Parse groove notation using template's mappings
 */
function parseGrooveNotation(
  value: string,
  template: ClientTemplate
): string | undefined {
  if (!template.grooveNotation) {
    // Fallback to common patterns
    if (value.toLowerCase() === "x") return "W2";
    return undefined;
  }
  
  for (const [notation, mappedSide] of Object.entries(template.grooveNotation)) {
    if (value.includes(notation)) {
      return mappedSide;
    }
  }
  
  return undefined;
}

// ============================================================
// HELPERS
// ============================================================

function mapDbTemplateToTemplate(data: Record<string, unknown>): ClientTemplate {
  return {
    id: data.id as string,
    organizationId: data.organization_id as string | null,
    clientName: data.client_name as string,
    clientAliases: (data.client_aliases as string[]) || [],
    columnOrder: data.column_order as string[],
    edgeNotation: data.edge_notation as Record<string, string[]> | undefined,
    grooveNotation: data.groove_notation as Record<string, string> | undefined,
    defaultMaterialId: data.default_material_id as string | undefined,
    defaultThicknessMm: data.default_thickness_mm as number | undefined,
    headerPatterns: (data.header_patterns as string[]) || [],
    sampleRows: data.sample_rows as Record<string, unknown>[] | undefined,
    notes: data.notes as string | undefined,
    confidence: data.confidence as number,
    usageCount: data.usage_count as number,
    successRate: data.success_rate as number,
    lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : undefined,
  };
}

