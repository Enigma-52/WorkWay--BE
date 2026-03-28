import { S3Client } from "@aws-sdk/client-s3";

// ---- CONFIG ----
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const ACCESS_KEY = process.env.CF_R2_ACCESS_KEY
const SECRET_KEY = process.env.CF_R2_SECRET_KEY
const BUCKET = "workway-static"

const CDN_BASE = "https://cdn.workway.dev";

export const R2Client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });