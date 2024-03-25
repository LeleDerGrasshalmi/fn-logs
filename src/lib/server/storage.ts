import { S3Client } from '@aws-sdk/client-s3';
import { env } from "$env/dynamic/private";

const storage = new S3Client({
    region: "auto",
    endpoint: env.STORAGE_ENDPOINT!,
    credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_ACCESS_KEY_SECRET!,
    },
});

export default storage;