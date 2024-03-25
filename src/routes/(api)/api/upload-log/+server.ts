import { error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import storage from "$lib/server/storage";
import { env } from "$env/dynamic/private";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import analyzeLog from "$lib/server/log-analyzer";

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

        const fileContent = await file.text();
        const output = analyzeLog(fileContent);

        if (!output.platform
            || !output.buildVersion
            || !output.engineVersion
        ) {
            error(400, {
                message: 'Incomplete file',
            });
        }

        const id = randomUUID();

        if (env.STORAGE_ENABLED?.toLowerCase() === 'true') {
            const command = new PutObjectCommand({
                Bucket: env.STORAGE_BUCKET,
                Key: `${output.buildVersion}-${output.platform}-${id}.txt`,
                Body: fileContent,
                ContentType: textPlainContentType,
                Metadata: {
                    'name': file.name,
                    'platform': output.platform,
                    'build-version': output.buildVersion,
                    'engine-version': output.engineVersion,
                },
            });

            const object = await storage.send(command, {
                requestTimeout: 15 * 1000,
            });

            console.log(object);
        }


        return new Response(JSON.stringify({
            id,
            data: output,
        }), {
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (err) {
        console.error(err);

        if (isHttpError(err)) {
            throw err;
        }

        error(500, {
            message: String(err),
        });
    }
}