import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { r2BucketName, r2Client } from "@/lib/blob/r2";

/**
 * GET endpoint to retrieve files directly from R2
 * Usage: /api/files/get?key=filename.jpg
 * This streams the file directly to the client
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 }
      );
    }

    // Get the file from R2
    const getCommand = new GetObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    });

    const response = await r2Client.send(getCommand);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Convert the stream to a buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Return the file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        "Content-Length": response.ContentLength?.toString() || "",
        "Cache-Control": "public, max-age=604800, immutable", // Cache for 7 days
      },
    });
  } catch (error) {
    console.error("Error retrieving file from R2:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}
