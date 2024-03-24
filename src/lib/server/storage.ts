import S3 from 'aws-sdk/clients/s3.js';
import { env } from "$env/dynamic/private";

const storage = new S3({
    endpoint: env.STORAGE_ENDPOINT,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_ACCESS_KEY_SECRET,
    signatureVersion: 'v4',
});

export default storage;