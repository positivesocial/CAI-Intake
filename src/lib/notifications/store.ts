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

