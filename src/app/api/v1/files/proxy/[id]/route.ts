/**
 * File Proxy API
 * 
 * Proxies file downloads from Supabase storage to bypass X-Frame-Options restrictions.
 * This allows PDFs to be embedded in iframes for preview.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, getServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authenticate user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await getServiceClient();

    // Get file record from database
    const { data: file, error: fileError } = await supabase
      .from("cutlist_source_files")
      .select("storage_path, original_name, mime_type, cutlist_id")
      .eq("id", id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this cutlist
    const { data: cutlist } = await supabase
      .from("cutlists")
      .select("user_id, org_id")
      .eq("id", file.cutlist_id)
      .single();

    if (!cutlist) {
      return NextResponse.json(
        { error: "Cutlist not found" },
        { status: 404 }
      );
    }

    // Check access - user owns the cutlist or is in the same org
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    const hasAccess = 
      cutlist.user_id === user.id ||
      (cutlist.org_id && cutlist.org_id === profile?.org_id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Download file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("cutlist-files")
      .download(file.storage_path);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Return file with proper headers for iframe embedding
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
        "Content-Length": buffer.length.toString(),
        // Allow embedding in iframes
        "X-Frame-Options": "SAMEORIGIN",
        // Cache for 1 hour
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("File proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


