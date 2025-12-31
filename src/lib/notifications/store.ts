/**
 * CAI Intake - Notifications Store
 * 
 * Manages in-app notifications for the user.
 * Notifications are persisted to localStorage and cleared on logout.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================
// TYPES
// ============================================================

export type NotificationType = 
  | "success" 
  | "error" 
  | "warning" 
  | "info" 
  | "cutlist" 
  | "file" 
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  /** Optional link to navigate to */
  link?: string;
  /** Optional metadata for the notification */
  metadata?: Record<string, unknown>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearRead: () => void;
}

// ============================================================
// STORE
// ============================================================

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          read: false,
        };
        
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
          unreadCount: state.unreadCount + 1,
        }));
      },

      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification || notification.read) return state;
          
          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          const wasUnread = notification && !notification.read;
          
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      clearRead: () => {
        set((state) => ({
          notifications: state.notifications.filter((n) => !n.read),
        }));
      },
    }),
    {
      name: "cai-notifications",
      version: 1,
    }
  )
);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Add a notification for a successful file processing
 */
export function notifyFileProcessed(fileName: string, partsCount: number, cutlistId?: string) {
  useNotificationStore.getState().addNotification({
    type: "file",
    title: "File Processed",
    message: `${fileName} - ${partsCount} part${partsCount !== 1 ? "s" : ""} extracted`,
    link: cutlistId ? `/cutlists/${cutlistId}` : undefined,
    metadata: { fileName, partsCount, cutlistId },
  });
}

/**
 * Add a notification for file processing error
 */
export function notifyFileError(fileName: string, error: string) {
  useNotificationStore.getState().addNotification({
    type: "error",
    title: "Processing Failed",
    message: `${fileName}: ${error}`,
    metadata: { fileName, error },
  });
}

/**
 * Add a notification for cutlist created
 */
export function notifyCutlistCreated(cutlistName: string, cutlistId: string) {
  useNotificationStore.getState().addNotification({
    type: "cutlist",
    title: "Cutlist Created",
    message: `"${cutlistName}" has been created and saved`,
    link: `/cutlists/${cutlistId}`,
    metadata: { cutlistName, cutlistId },
  });
}

/**
 * Add a notification for cutlist exported
 */
export function notifyCutlistExported(cutlistName: string, format: string) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Export Complete",
    message: `"${cutlistName}" exported as ${format.toUpperCase()}`,
    metadata: { cutlistName, format },
  });
}

/**
 * Add a system notification
 */
export function notifySystem(title: string, message: string) {
  useNotificationStore.getState().addNotification({
    type: "system",
    title,
    message,
  });
}

/**
 * Add an info notification
 */
export function notifyInfo(title: string, message: string, link?: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title,
    message,
    link,
  });
}

/**
 * Add a warning notification
 */
export function notifyWarning(title: string, message: string) {
  useNotificationStore.getState().addNotification({
    type: "warning",
    title,
    message,
  });
}

// ============================================================
// CUTLIST NOTIFICATIONS
// ============================================================

/**
 * Add a notification for cutlist saved/updated
 */
export function notifyCutlistSaved(cutlistName: string, cutlistId: string, partsCount?: number) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Cutlist Saved",
    message: partsCount 
      ? `"${cutlistName}" saved with ${partsCount} part${partsCount !== 1 ? "s" : ""}`
      : `"${cutlistName}" has been saved`,
    link: `/cutlists/${cutlistId}`,
    metadata: { cutlistName, cutlistId, partsCount },
  });
}

/**
 * Add a notification for cutlist deleted
 */
export function notifyCutlistDeleted(cutlistName: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title: "Cutlist Deleted",
    message: `"${cutlistName}" has been deleted`,
    metadata: { cutlistName },
  });
}

// ============================================================
// MATERIAL NOTIFICATIONS
// ============================================================

/**
 * Add a notification for material created
 */
export function notifyMaterialCreated(materialName: string, materialId?: string) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Material Created",
    message: `"${materialName}" has been added to your materials`,
    link: materialId ? `/settings/materials` : undefined,
    metadata: { materialName, materialId },
  });
}

/**
 * Add a notification for material updated
 */
export function notifyMaterialUpdated(materialName: string) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Material Updated",
    message: `"${materialName}" has been updated`,
    metadata: { materialName },
  });
}

/**
 * Add a notification for material deleted
 */
export function notifyMaterialDeleted(materialName: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title: "Material Deleted",
    message: `"${materialName}" has been removed`,
    metadata: { materialName },
  });
}

/**
 * Add a notification for materials imported
 */
export function notifyMaterialsImported(count: number) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Materials Imported",
    message: `${count} material${count !== 1 ? "s" : ""} imported successfully`,
    link: "/settings/materials",
    metadata: { count },
  });
}

// ============================================================
// EDGEBAND NOTIFICATIONS
// ============================================================

/**
 * Add a notification for edgeband created
 */
export function notifyEdgebandCreated(edgebandName: string) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Edgeband Created",
    message: `"${edgebandName}" has been added`,
    link: "/settings/edgebands",
    metadata: { edgebandName },
  });
}

/**
 * Add a notification for edgeband updated
 */
export function notifyEdgebandUpdated(edgebandName: string) {
  useNotificationStore.getState().addNotification({
    type: "success",
    title: "Edgeband Updated",
    message: `"${edgebandName}" has been updated`,
    metadata: { edgebandName },
  });
}

/**
 * Add a notification for edgeband deleted
 */
export function notifyEdgebandDeleted(edgebandName: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title: "Edgeband Deleted",
    message: `"${edgebandName}" has been removed`,
    metadata: { edgebandName },
  });
}

// ============================================================
// OPERATIONS NOTIFICATIONS
// ============================================================

/**
 * Add a notification for operation created (generic)
 */
export function notifyOperationCreated(opType: "groove" | "drilling" | "cnc" | "edgeband", opName: string) {
  const typeLabels = {
    groove: "Groove Profile",
    drilling: "Drill Pattern",
    cnc: "CNC Operation",
    edgeband: "Edgeband",
  };
  
  useNotificationStore.getState().addNotification({
    type: "success",
    title: `${typeLabels[opType]} Created`,
    message: `"${opName}" has been added`,
    metadata: { opType, opName },
  });
}

/**
 * Add a notification for operation updated (generic)
 */
export function notifyOperationUpdated(opType: "groove" | "drilling" | "cnc" | "edgeband", opName: string) {
  const typeLabels = {
    groove: "Groove Profile",
    drilling: "Drill Pattern",
    cnc: "CNC Operation",
    edgeband: "Edgeband",
  };
  
  useNotificationStore.getState().addNotification({
    type: "success",
    title: `${typeLabels[opType]} Updated`,
    message: `"${opName}" has been updated`,
    metadata: { opType, opName },
  });
}

/**
 * Add a notification for operation deleted (generic)
 */
export function notifyOperationDeleted(opType: "groove" | "drilling" | "cnc" | "edgeband", opName: string) {
  const typeLabels = {
    groove: "Groove Profile",
    drilling: "Drill Pattern",
    cnc: "CNC Operation",
    edgeband: "Edgeband",
  };
  
  useNotificationStore.getState().addNotification({
    type: "info",
    title: `${typeLabels[opType]} Deleted`,
    message: `"${opName}" has been removed`,
    metadata: { opType, opName },
  });
}

// ============================================================
// DRAFT NOTIFICATIONS
// ============================================================

/**
 * Add a notification for draft saved
 */
export function notifyDraftSaved(draftName?: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title: "Draft Saved",
    message: draftName 
      ? `Draft "${draftName}" saved automatically`
      : "Your progress has been saved as a draft",
    link: "/cutlists?tab=drafts",
    metadata: { draftName },
  });
}

/**
 * Add a notification for draft restored
 */
export function notifyDraftRestored(draftName?: string) {
  useNotificationStore.getState().addNotification({
    type: "info",
    title: "Draft Restored",
    message: draftName 
      ? `Restored draft "${draftName}"`
      : "Your previous work has been restored",
    metadata: { draftName },
  });
}

