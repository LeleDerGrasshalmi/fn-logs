import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import storage from "$lib/server/storage";
import { env } from "$env/dynamic/private";
import { randomUUID } from "crypto";

export const POST: RequestHandler = async ({ request }) => {
    // error handling...
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
        error(400, {
            message: 'Invalid file',
        });
    }

    const object = await storage.upload({
        Bucket: env.STORAGE_BUCKET,
        Key: `${randomUUID()}.txt`,
        Body: Buffer.from(await file.arrayBuffer()), // (;
        ContentType: file.type,
        Metadata: {
            'name': file.name,
        },
    }).promise();

    return new Response(JSON.stringify({
        key: object.Key
    }));
}