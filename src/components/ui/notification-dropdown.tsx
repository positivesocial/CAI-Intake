"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  FolderOpen,
  Settings,
  X,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";

// ============================================================
// HELPERS
// ============================================================

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "success":
      return Check;
    case "error":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
    case "cutlist":
      return FolderOpen;
    case "file":
      return FileText;
    case "system":
      return Settings;
    default:
      return Bell;
  }
}

function getNotificationColor(type: NotificationType) {
  switch (type) {
    case "success":
      return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
    case "error":
      return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
    case "warning":
      return "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
    case "info":
      return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
    case "cutlist":
      return "text-[var(--cai-teal)] bg-[var(--cai-teal)]/10";
    case "file":
      return "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30";
    case "system":
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    default:
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
  }
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================
// NOTIFICATION ITEM
// ============================================================

function NotificationItem({
  notification,
  onMarkRead,
  onRemove,
  onClick,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onRemove: () => void;
  onClick: () => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type);
  
  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-3 hover:bg-[var(--muted)] transition-colors cursor-pointer",
        !notification.read && "bg-[var(--cai-teal)]/5"
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn("p-2 rounded-lg flex-shrink-0", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm font-medium truncate",
            !notification.read && "text-[var(--foreground)]",
            notification.read && "text-[var(--muted-foreground)]"
          )}>
            {notification.title}
          </p>
          <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
            {formatTimeAgo(notification.timestamp)}
          </span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      </div>
      
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[var(--cai-teal)] rounded-full" />
      )}
      
      {/* Action buttons (visible on hover) */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-red-600"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION DROPDOWN
// ============================================================

export function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    clearRead,
  } = useNotificationStore();
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);
  
  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.link) {
      router.push(notification.link);
      setIsOpen(false);
    }
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="p-2 hover:bg-[var(--muted)] rounded-lg relative transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--card)] rounded-lg shadow-lg border border-[var(--border)] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[var(--cai-teal)]/10 text-[var(--cai-teal)] text-xs font-medium rounded">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-red-600 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          
          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-3" />
                <p className="text-sm text-[var(--muted-foreground)]">
                  No notifications yet
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  You&apos;ll see updates here when you process files or create cutlists
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markAsRead(notification.id)}
                    onRemove={() => removeNotification(notification.id)}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {notifications.length > 0 && notifications.some((n) => n.read) && (
            <div className="px-4 py-2 border-t border-[var(--border)]">
              <button
                onClick={clearRead}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Clear read notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

