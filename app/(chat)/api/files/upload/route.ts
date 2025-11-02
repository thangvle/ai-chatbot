import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { r2BucketName, r2Client } from "@/lib/blob/r2";
import { generateUUID } from "@/lib/utils";

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine(
      (file) =>
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/csv",
          "text/csv",
        ].includes(file.type),
      {
        message: "File type should be JPEG or PNG or WebP or CSV",
      }
    ),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get("file") as File).name;
    const ext = filename.split(".").pop();
    const uniqueFileName = `${generateUUID()}.${ext}`;
    const fileBuffer = await file.arrayBuffer();

    try {
      // const data = await put(`${uniqueFileName}`, fileBuffer, {
      //   access: "public",
      // });

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: r2BucketName,
        Key: uniqueFileName,
        Body: Buffer.from(fileBuffer),
        ContentType: file.type,
      });

      await r2Client.send(command);

      // Generate proxy URL instead of signed URL to avoid expiration
      const proxyUrl = `/api/files/get?key=${uniqueFileName}`;

      return NextResponse.json({
        url: proxyUrl,
        pathname: uniqueFileName,
        contentType: file.type,
      });
    } catch (_error) {
      console.error("Upload Error", _error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    console.error("Request Error", _error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
