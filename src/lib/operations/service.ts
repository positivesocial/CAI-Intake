/**
 * CAI Intake - Operations Service
 * 
 * CRUD operations for the unified operations system.
 * Handles operation types, edgeband, groove, drilling, and CNC operations.
 */

import { db as prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  OperationType,
  OperationTypeInput,
  OperationCategory,
  EdgebandOperation,
  EdgebandOperationInput,
  GrooveOperation,
  GrooveOperationInput,
  DrillingOperation,
  DrillingOperationInput,
  CncOperation,
  CncOperationInput,
  HoleDefinition,
  EdgeSide,
} from "./types";
import { getSystemDefaults } from "./defaults";

// ============================================================
// OPERATION TYPES
// ============================================================

/**
 * Get all operation types for an organization
 * Returns both system types and org-specific types
 */
export async function getOperationTypes(
  organizationId?: string,
  category?: OperationCategory
): Promise<OperationType[]> {
  const where: Record<string, unknown> = {
    isActive: true,
    OR: [
      { organizationId: null }, // System types
      ...(organizationId ? [{ organizationId }] : []),
    ],
  };

  if (category) {
    where.category = category;
  }

  const types = await prisma.operationType.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return types.map(mapOperationType);
}

/**
 * Create an operation type
 */
export async function createOperationType(
  input: OperationTypeInput,
  organizationId?: string
): Promise<OperationType> {
  const type = await prisma.operationType.create({
    data: {
      category: input.category,
      code: input.code,
      name: input.name,
      description: input.description,
      icon: input.icon,
      isActive: input.isActive ?? true,
      displayOrder: input.displayOrder ?? 0,
      isSystem: !organizationId,
      organizationId,
    },
  });

  return mapOperationType(type);
}

/**
 * Update an operation type
 */
export async function updateOperationType(
  id: string,
  input: Partial<OperationTypeInput>
): Promise<OperationType> {
  const type = await prisma.operationType.update({
    where: { id },
    data: {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
    },
  });

  return mapOperationType(type);
}

/**
 * Delete an operation type
 */
export async function deleteOperationType(id: string): Promise<void> {
  await prisma.operationType.delete({ where: { id } });
}

// ============================================================
// EDGEBAND OPERATIONS
// ============================================================

/**
 * Get all edgeband operations for an organization
 */
export async function getEdgebandOperations(
  organizationId?: string
): Promise<EdgebandOperation[]> {
  const ops = await prisma.edgebandOperation.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    orderBy: [{ usageCount: "desc" }, { code: "asc" }],
  });

  return ops.map(mapEdgebandOperation);
}

/**
 * Find edgeband operation by code
 */
export async function findEdgebandByCode(
  code: string,
  organizationId?: string
): Promise<EdgebandOperation | null> {
  // First try org-specific
  if (organizationId) {
    const orgOp = await prisma.edgebandOperation.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        organizationId,
        isActive: true,
      },
    });
    if (orgOp) return mapEdgebandOperation(orgOp);
  }

  // Fall back to system
  const sysOp = await prisma.edgebandOperation.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      organizationId: null,
      isActive: true,
    },
  });

  return sysOp ? mapEdgebandOperation(sysOp) : null;
}

/**
 * Create edgeband operation
 */
export async function createEdgebandOperation(
  input: EdgebandOperationInput,
  organizationId?: string
): Promise<EdgebandOperation> {
  const op = await prisma.edgebandOperation.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      edges: input.edges,
      materialId: input.materialId,
      thicknessMm: input.thicknessMm,
      isActive: input.isActive ?? true,
      organizationId,
    },
  });

  return mapEdgebandOperation(op);
}

/**
 * Update edgeband operation
 */
export async function updateEdgebandOperation(
  id: string,
  input: Partial<EdgebandOperationInput>
): Promise<EdgebandOperation> {
  const op = await prisma.edgebandOperation.update({
    where: { id },
    data: {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.edges !== undefined && { edges: input.edges }),
      ...(input.materialId !== undefined && { materialId: input.materialId }),
      ...(input.thicknessMm !== undefined && { thicknessMm: input.thicknessMm }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return mapEdgebandOperation(op);
}

/**
 * Delete edgeband operation
 */
export async function deleteEdgebandOperation(id: string): Promise<void> {
  await prisma.edgebandOperation.delete({ where: { id } });
}

/**
 * Increment usage count
 */
export async function incrementEdgebandUsage(id: string): Promise<void> {
  await prisma.edgebandOperation.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

// ============================================================
// GROOVE OPERATIONS
// ============================================================

/**
 * Get all groove operations for an organization
 */
export async function getGrooveOperations(
  organizationId?: string
): Promise<GrooveOperation[]> {
  const ops = await prisma.grooveOperation.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    include: { operationType: true },
    orderBy: [{ usageCount: "desc" }, { code: "asc" }],
  });

  return ops.map(mapGrooveOperation);
}

/**
 * Find groove operation by code
 */
export async function findGrooveByCode(
  code: string,
  organizationId?: string
): Promise<GrooveOperation | null> {
  if (organizationId) {
    const orgOp = await prisma.grooveOperation.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        organizationId,
        isActive: true,
      },
      include: { operationType: true },
    });
    if (orgOp) return mapGrooveOperation(orgOp);
  }

  const sysOp = await prisma.grooveOperation.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      organizationId: null,
      isActive: true,
    },
    include: { operationType: true },
  });

  return sysOp ? mapGrooveOperation(sysOp) : null;
}

/**
 * Create groove operation
 */
export async function createGrooveOperation(
  input: GrooveOperationInput,
  organizationId?: string
): Promise<GrooveOperation> {
  const op = await prisma.grooveOperation.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      typeId: input.typeId,
      widthMm: input.widthMm,
      depthMm: input.depthMm,
      offsetFromEdgeMm: input.offsetFromEdgeMm ?? 10,
      edge: input.edge,
      isActive: input.isActive ?? true,
      organizationId,
    },
    include: { operationType: true },
  });

  return mapGrooveOperation(op);
}

/**
 * Update groove operation
 */
export async function updateGrooveOperation(
  id: string,
  input: Partial<GrooveOperationInput>
): Promise<GrooveOperation> {
  const op = await prisma.grooveOperation.update({
    where: { id },
    data: {
      ...(input.code !== undefined && { code: input.code }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.typeId !== undefined && { typeId: input.typeId }),
      ...(input.widthMm !== undefined && { widthMm: input.widthMm }),
      ...(input.depthMm !== undefined && { depthMm: input.depthMm }),
      ...(input.offsetFromEdgeMm !== undefined && { offsetFromEdgeMm: input.offsetFromEdgeMm }),
      ...(input.edge !== undefined && { edge: input.edge }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: { operationType: true },
  });

  return mapGrooveOperation(op);
}

/**
 * Delete groove operation
 */
export async function deleteGrooveOperation(id: string): Promise<void> {
  await prisma.grooveOperation.delete({ where: { id } });
}

/**
 * Increment usage count
 */
export async function incrementGrooveUsage(id: string): Promise<void> {
  await prisma.grooveOperation.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

// ============================================================
// DRILLING OPERATIONS
// ============================================================

/**
 * Get all drilling operations for an organization
 */
export async function getDrillingOperations(
  organizationId?: string
): Promise<DrillingOperation[]> {
  const ops = await prisma.drillingOperation.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    include: { operationType: true },
    orderBy: [{ usageCount: "desc" }, { code: "asc" }],
  });

  return ops.map(mapDrillingOperation);
}

/**
 * Find drilling operation by code
 */
export async function findDrillingByCode(
  code: string,
  organizationId?: string
): Promise<DrillingOperation | null> {
  if (organizationId) {
    const orgOp = await prisma.drillingOperation.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        organizationId,
        isActive: true,
      },
      include: { operationType: true },
    });
    if (orgOp) return mapDrillingOperation(orgOp);
  }

  const sysOp = await prisma.drillingOperation.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      organizationId: null,
      isActive: true,
    },
    include: { operationType: true },
  });

  return sysOp ? mapDrillingOperation(sysOp) : null;
}

/**
 * Create drilling operation
 */
export async function createDrillingOperation(
  input: DrillingOperationInput,
  organizationId?: string
): Promise<DrillingOperation> {
  const op = await prisma.drillingOperation.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      typeId: input.typeId,
      holes: input.holes as unknown as Prisma.InputJsonValue,
      refEdge: input.refEdge,
      refCorner: input.refCorner,
      hardwareBrand: input.hardwareBrand,
      hardwareModel: input.hardwareModel,
      isActive: input.isActive ?? true,
      organizationId,
    },
    include: { operationType: true },
  });

  return mapDrillingOperation(op);
}

/**
 * Update drilling operation
 */
export async function updateDrillingOperation(
  id: string,
  input: Partial<DrillingOperationInput>
): Promise<DrillingOperation> {
  const updateData: Prisma.DrillingOperationUpdateInput = {};
  
  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.typeId !== undefined) updateData.operationType = { connect: { id: input.typeId } };
  if (input.holes !== undefined) updateData.holes = input.holes as unknown as Prisma.InputJsonValue;
  if (input.refEdge !== undefined) updateData.refEdge = input.refEdge;
  if (input.refCorner !== undefined) updateData.refCorner = input.refCorner;
  if (input.hardwareBrand !== undefined) updateData.hardwareBrand = input.hardwareBrand;
  if (input.hardwareModel !== undefined) updateData.hardwareModel = input.hardwareModel;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  
  const op = await prisma.drillingOperation.update({
    where: { id },
    data: updateData,
    include: { operationType: true },
  });

  return mapDrillingOperation(op);
}

/**
 * Delete drilling operation
 */
export async function deleteDrillingOperation(id: string): Promise<void> {
  await prisma.drillingOperation.delete({ where: { id } });
}

/**
 * Increment usage count
 */
export async function incrementDrillingUsage(id: string): Promise<void> {
  await prisma.drillingOperation.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

// ============================================================
// CNC OPERATIONS
// ============================================================

/**
 * Get all CNC operations for an organization
 */
export async function getCncOperations(
  organizationId?: string
): Promise<CncOperation[]> {
  const ops = await prisma.cncOperation.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    include: { operationType: true },
    orderBy: [{ usageCount: "desc" }, { code: "asc" }],
  });

  return ops.map(mapCncOperation);
}

/**
 * Find CNC operation by code
 */
export async function findCncByCode(
  code: string,
  organizationId?: string
): Promise<CncOperation | null> {
  if (organizationId) {
    const orgOp = await prisma.cncOperation.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        organizationId,
        isActive: true,
      },
      include: { operationType: true },
    });
    if (orgOp) return mapCncOperation(orgOp);
  }

  const sysOp = await prisma.cncOperation.findFirst({
    where: {
      code: { equals: code, mode: "insensitive" },
      organizationId: null,
      isActive: true,
    },
    include: { operationType: true },
  });

  return sysOp ? mapCncOperation(sysOp) : null;
}

/**
 * Create CNC operation
 */
export async function createCncOperation(
  input: CncOperationInput,
  organizationId?: string
): Promise<CncOperation> {
  const op = await prisma.cncOperation.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      typeId: input.typeId,
      opType: input.opType,
      parametricConfig: input.parametricConfig 
        ? (input.parametricConfig as Prisma.InputJsonValue) 
        : Prisma.JsonNull,
      shapeId: input.shapeId,
      params: input.params ? (input.params as Prisma.InputJsonValue) : Prisma.JsonNull,
      isActive: input.isActive ?? true,
      organizationId,
    },
    include: { operationType: true },
  });

  return mapCncOperation(op);
}

/**
 * Update CNC operation
 */
export async function updateCncOperation(
  id: string,
  input: Partial<CncOperationInput>
): Promise<CncOperation> {
  const updateData: Prisma.CncOperationUpdateInput = {};

  if (input.code !== undefined) updateData.code = input.code;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.typeId !== undefined) updateData.operationType = { connect: { id: input.typeId } };
  if (input.opType !== undefined) updateData.opType = input.opType;
  if (input.parametricConfig !== undefined) {
    updateData.parametricConfig = input.parametricConfig 
      ? (input.parametricConfig as Prisma.InputJsonValue) 
      : Prisma.JsonNull;
  }
  if (input.shapeId !== undefined) updateData.shapeId = input.shapeId;
  if (input.params !== undefined) {
    updateData.params = input.params ? (input.params as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  
  const op = await prisma.cncOperation.update({
    where: { id },
    data: updateData,
    include: { operationType: true },
  });

  return mapCncOperation(op);
}

/**
 * Delete CNC operation
 */
export async function deleteCncOperation(id: string): Promise<void> {
  await prisma.cncOperation.delete({ where: { id } });
}

/**
 * Increment usage count
 */
export async function incrementCncUsage(id: string): Promise<void> {
  await prisma.cncOperation.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

// ============================================================
// SEEDING
// ============================================================

/**
 * Seed system default operations
 * Only creates if they don't exist
 */
export async function seedSystemDefaults(): Promise<{
  types: number;
  edgeband: number;
  groove: number;
  drilling: number;
  cnc: number;
}> {
  const defaults = getSystemDefaults();
  const results = { types: 0, edgeband: 0, groove: 0, drilling: 0, cnc: 0 };

  // Seed operation types
  for (const input of defaults.operationTypes) {
    const existing = await prisma.operationType.findFirst({
      where: {
        category: input.category,
        code: input.code,
        organizationId: null,
      },
    });

    if (!existing) {
      await prisma.operationType.create({
        data: {
          ...input,
          isSystem: true,
          organizationId: null,
        },
      });
      results.types++;
    }
  }

  // Seed edgeband operations
  for (const input of defaults.edgebandOperations) {
    const existing = await prisma.edgebandOperation.findFirst({
      where: {
        code: input.code,
        organizationId: null,
      },
    });

    if (!existing) {
      await prisma.edgebandOperation.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          edges: input.edges,
          materialId: input.materialId,
          thicknessMm: input.thicknessMm,
          organizationId: null,
        },
      });
      results.edgeband++;
    }
  }

  // Seed groove operations
  for (const input of defaults.grooveOperations) {
    const existing = await prisma.grooveOperation.findFirst({
      where: {
        code: input.code,
        organizationId: null,
      },
    });

    if (!existing) {
      await prisma.grooveOperation.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          widthMm: input.widthMm,
          depthMm: input.depthMm,
          offsetFromEdgeMm: input.offsetFromEdgeMm ?? 10,
          edge: input.edge,
          organizationId: null,
        },
      });
      results.groove++;
    }
  }

  // Seed drilling operations
  for (const input of defaults.drillingOperations) {
    const existing = await prisma.drillingOperation.findFirst({
      where: {
        code: input.code,
        organizationId: null,
      },
    });

    if (!existing) {
      await prisma.drillingOperation.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          holes: input.holes as unknown as Prisma.InputJsonValue,
          refEdge: input.refEdge,
          refCorner: input.refCorner,
          hardwareBrand: input.hardwareBrand,
          hardwareModel: input.hardwareModel,
          organizationId: null,
        },
      });
      results.drilling++;
    }
  }

  // Seed CNC operations
  for (const input of defaults.cncOperations) {
    const existing = await prisma.cncOperation.findFirst({
      where: {
        code: input.code,
        organizationId: null,
      },
    });

    if (!existing) {
      await prisma.cncOperation.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          opType: input.opType,
          params: input.params 
            ? (input.params as unknown as Prisma.InputJsonValue) 
            : Prisma.JsonNull,
          organizationId: null,
        },
      });
      results.cnc++;
    }
  }

  return results;
}

// ============================================================
// MAPPERS
// ============================================================

function mapOperationType(op: {
  id: string;
  organizationId: string | null;
  category: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): OperationType {
  return {
    id: op.id,
    organizationId: op.organizationId,
    category: op.category as OperationCategory,
    code: op.code,
    name: op.name,
    description: op.description ?? undefined,
    icon: op.icon ?? undefined,
    isSystem: op.isSystem,
    isActive: op.isActive,
    displayOrder: op.displayOrder,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}

function mapEdgebandOperation(op: {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  edges: string[];
  materialId: string | null;
  thicknessMm: number | null;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}): EdgebandOperation {
  return {
    id: op.id,
    organizationId: op.organizationId,
    code: op.code,
    name: op.name,
    description: op.description ?? undefined,
    edges: op.edges as EdgeSide[],
    materialId: op.materialId ?? undefined,
    thicknessMm: op.thicknessMm ?? undefined,
    isActive: op.isActive,
    usageCount: op.usageCount,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGrooveOperation(op: any): GrooveOperation {
  return {
    id: op.id,
    organizationId: op.organizationId,
    code: op.code,
    name: op.name,
    description: op.description ?? undefined,
    typeId: op.typeId ?? undefined,
    type: op.operationType ? mapOperationType(op.operationType) : undefined,
    widthMm: op.widthMm,
    depthMm: op.depthMm,
    offsetFromEdgeMm: op.offsetFromEdgeMm,
    edge: op.edge as EdgeSide | undefined,
    isActive: op.isActive,
    usageCount: op.usageCount,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDrillingOperation(op: any): DrillingOperation {
  return {
    id: op.id,
    organizationId: op.organizationId,
    code: op.code,
    name: op.name,
    description: op.description ?? undefined,
    typeId: op.typeId ?? undefined,
    type: op.operationType ? mapOperationType(op.operationType) : undefined,
    holes: (op.holes || []) as HoleDefinition[],
    refEdge: op.refEdge as EdgeSide | undefined,
    refCorner: op.refCorner ?? undefined,
    hardwareBrand: op.hardwareBrand ?? undefined,
    hardwareModel: op.hardwareModel ?? undefined,
    isActive: op.isActive,
    usageCount: op.usageCount,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCncOperation(op: any): CncOperation {
  return {
    id: op.id,
    organizationId: op.organizationId,
    code: op.code,
    name: op.name,
    description: op.description ?? undefined,
    typeId: op.typeId ?? undefined,
    type: op.operationType ? mapOperationType(op.operationType) : undefined,
    opType: op.opType,
    parametricConfig: op.parametricConfig ?? undefined,
    shapeId: op.shapeId ?? undefined,
    params: op.params ?? undefined,
    isActive: op.isActive,
    usageCount: op.usageCount,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
  };
}
