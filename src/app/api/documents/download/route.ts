import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("id");
    if (!docId) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Fetch document record
    const supabase = createClient();
    const { data: doc, error } = await supabase
      .from("documents")
      .select("file_name, file_url")
      .eq("id", docId)
      .single();

    if (error || !doc?.file_url)
      return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Check if it's a real URL (not a placeholder)
    if (doc.file_url.includes("placeholder.com")) {
      return NextResponse.json(
        { error: "This document uses a placeholder URL. Upload a real file to enable downloads." },
        { status: 400 }
      );
    }

    // Proxy-fetch the file (avoids CORS on cross-origin Supabase Storage URLs)
    const fileRes = await fetch(doc.file_url);
    if (!fileRes.ok)
      return NextResponse.json({ error: `File fetch failed: ${fileRes.status}` }, { status: 502 });

    const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
    const buffer      = await fileRes.arrayBuffer();

    // Sanitise filename for Content-Disposition
    const safe = doc.file_name.replace(/[^\w.\-]/g, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Content-Length":      String(buffer.byteLength),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
