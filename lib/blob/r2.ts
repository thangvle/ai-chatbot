import { S3Client } from "@aws-sdk/client-s3";

const R2Endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * R2 Client config with S3
 */

export const r2Client = new S3Client({
  endpoint: R2Endpoint,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

export const r2BucketName = process.env.R2_BUCKET_NAME as string;
