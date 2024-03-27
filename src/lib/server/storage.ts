import { S3Client } from '@aws-sdk/client-s3';
import { env } from "$env/dynamic/private";

export const storage = new S3Client({
    region: "auto",
    endpoint: env.STORAGE_ENDPOINT!,
    credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_ACCESS_KEY_SECRET!,
    },
});

export const storageEnabled = env.STORAGE_ENABLED === 'true';