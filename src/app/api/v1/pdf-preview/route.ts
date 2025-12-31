/**
 * PDF Preview API
 * 
 * POST /api/v1/pdf-preview
 * Converts PDF pages to images for preview in the browser.
 * Used when blob URLs can't be displayed in iframes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { convertPdfToImages } from "@/lib/pdf/pdf-to-images";

// Limit to 5 pages for preview
const MAX_PREVIEW_PAGES = 5;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Verify it's a PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }
    
    // Limit file size for preview (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large for preview. Maximum 10MB." },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert PDF to images
    const result = await convertPdfToImages(buffer, {
      scale: 1.5, // Lower quality for preview (faster)
      maxPages: MAX_PREVIEW_PAGES,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to convert PDF" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      images: result.images,
      pageCount: result.pageCount,
      totalPages: result.pageCount, // For UI reference
    });
    
  } catch (error) {
    console.error("PDF preview error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF preview" },
      { status: 500 }
    );
  }
}

