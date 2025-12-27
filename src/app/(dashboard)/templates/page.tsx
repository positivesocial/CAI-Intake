"use client";

import * as React from "react";
import { QrCode, Download, FileText, Printer } from "lucide-react";
import { TemplateGenerator } from "@/components/intake/TemplateGenerator";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--cai-teal)]/10">
            <QrCode className="h-5 w-5 text-[var(--cai-teal)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Generate branded templates with QR codes for AI-powered parsing
            </p>
          </div>
        </div>
      </div>

      {/* Template Generator */}
      <TemplateGenerator />

      {/* Quick Actions / Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3 mb-2">
            <Printer className="h-5 w-5 text-[var(--cai-teal)]" />
            <h3 className="font-medium">Print & Fill</h3>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Download PDF templates to print for your workshop. Fill in by hand using BLOCK LETTERS for best OCR accuracy.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-[var(--cai-teal)]" />
            <h3 className="font-medium">Excel Templates</h3>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Download Excel templates with separate sheets for the cutlist, fill-in guide, and materials reference.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3 mb-2">
            <Download className="h-5 w-5 text-[var(--cai-teal)]" />
            <h3 className="font-medium">Upload & Parse</h3>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            After filling templates, upload photos or scans via{" "}
            <a href="/intake" className="text-[var(--cai-teal)] hover:underline">
              Intake → File Upload
            </a>{" "}
            for automatic parsing.
          </p>
        </div>
      </div>
    </div>
  );
}

