"use client";

/**
 * CAI Intake - Responsive Table Components
 * 
 * Mobile-optimized table that transforms to card layout on small screens.
 * Uses "MobileTable" prefix to avoid conflicts with base Table components.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

const MobileTable = React.forwardRef<HTMLTableElement, MobileTableProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full overflow-auto -webkit-overflow-scrolling-touch">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm",
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
MobileTable.displayName = "MobileTable";

const MobileTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(
      "[&_tr]:border-b",
      // Hide header on mobile when using card layout
      "hidden sm:table-header-group",
      className
    )} 
    {...props} 
  />
));
MobileTableHeader.displayName = "MobileTableHeader";

const MobileTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      "[&_tr:last-child]:border-0",
      // Stack rows as cards on mobile
      "flex flex-col gap-3 sm:table-row-group",
      className
    )}
    {...props}
  />
));
MobileTableBody.displayName = "MobileTableBody";

const MobileTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-[var(--muted)]/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
MobileTableFooter.displayName = "MobileTableFooter";

const MobileTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-[var(--muted)]/50 data-[state=selected]:bg-[var(--muted)]",
      // Card layout on mobile
      "flex flex-col p-4 rounded-lg border bg-[var(--card)] sm:table-row sm:p-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent",
      // Touch optimization
      "touch-manipulation",
      className
    )}
    {...props}
  />
));
MobileTableRow.displayName = "MobileTableRow";

interface MobileTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Whether this column should be hidden on mobile */
  hideMobile?: boolean;
}

const MobileTableHead = React.forwardRef<HTMLTableCellElement, MobileTableHeadProps>(
  ({ className, hideMobile, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 sm:h-10 px-3 sm:px-4 text-left align-middle font-medium text-[var(--muted-foreground)] [&:has([role=checkbox])]:pr-0",
        hideMobile && "hidden sm:table-cell",
        className
      )}
      {...props}
    />
  )
);
MobileTableHead.displayName = "MobileTableHead";

interface MobileTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Label to show on mobile (appears before the value) */
  mobileLabel?: string;
  /** Whether this cell should be hidden on mobile */
  hideMobile?: boolean;
  /** Whether this is a primary cell (shows as header on mobile) */
  primary?: boolean;
}

const MobileTableCell = React.forwardRef<HTMLTableCellElement, MobileTableCellProps>(
  ({ className, mobileLabel, hideMobile, primary, children, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "align-middle [&:has([role=checkbox])]:pr-0",
        // Desktop padding
        "sm:p-4",
        // Mobile: flex layout with label
        "flex items-center justify-between gap-2 py-1.5 sm:table-cell",
        // Primary cell styling on mobile
        primary && "font-semibold text-base sm:text-sm sm:font-normal pb-2 sm:pb-0 border-b sm:border-0 mb-2 sm:mb-0",
        // Hide on mobile
        hideMobile && "hidden sm:table-cell",
        className
      )}
      {...props}
    >
      {/* Mobile label */}
      {mobileLabel && (
        <span className="text-xs text-[var(--muted-foreground)] sm:hidden">
          {mobileLabel}
        </span>
      )}
      {/* Cell content */}
      <span className={cn(
        "text-right sm:text-left",
        primary && "text-left w-full"
      )}>
        {children}
      </span>
    </td>
  )
);
MobileTableCell.displayName = "MobileTableCell";

const MobileTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-[var(--muted-foreground)]", className)}
    {...props}
  />
));
MobileTableCaption.displayName = "MobileTableCaption";

/**
 * Empty state for tables
 */
interface MobileTableEmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function MobileTableEmpty({ icon, title, description, action }: MobileTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="text-[var(--muted-foreground)] mb-4">{icon}</div>
      )}
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

export {
  MobileTable,
  MobileTableHeader,
  MobileTableBody,
  MobileTableFooter,
  MobileTableHead,
  MobileTableRow,
  MobileTableCell,
  MobileTableCaption,
  MobileTableEmpty,
};

