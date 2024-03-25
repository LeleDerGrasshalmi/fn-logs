import { error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import storage from "$lib/server/storage";
import { env } from "$env/dynamic/private";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const textPlainContentType = "text/plain";

export const POST: RequestHandler = async ({ request }) => {
    try {
        if (!request.body) {
            error(400, {
                message: 'Invalid request',
            });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)
            || file.size === 0
            || file.type !== textPlainContentType
        ) {
            error(400, {
                message: 'Invalid file',
            });
        }

        const id = randomUUID();

        const command = new PutObjectCommand({
            Bucket: env.STORAGE_BUCKET,
            Key: `${id}.txt`,
            Body: Buffer.from(await file.arrayBuffer()), // (;
            ContentType: textPlainContentType,
            Metadata: {
                'name': file.name,
            },
        })

        const object = await storage.send(command, {
            requestTimeout: 15 * 1000,
        });

        console.log(object);

        return new Response(JSON.stringify({
            id,
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (err) {
        console.error(err);

        if (isHttpError(err)) {
            throw err;
        }

        error(400, {
            message: String(err),
        });
    }
}