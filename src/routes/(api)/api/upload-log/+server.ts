import { error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { storage, storageEnabled } from "$lib/server/storage";
import { env } from "$env/dynamic/private";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import analyzeLog from "$lib/server/log-analyzer";

const textPlainContentType = "text/plain";
const ocetStreamContentType = "application/octet-stream";

export const POST: RequestHandler = async ({ request }) => {
    try {
        if (!request.body) {
            error(400, {
                message: 'Invalid request',
            });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            error(400, {
                message: 'File is missing',
            });
        }

        if (!(file instanceof File)) {
            error(400, {
                message: 'Not a file',
            });
        }

        if (file.size === 0) {
            error(400, {
                message: 'File is empty',
            });
        }

        // we must support ocet stream content type, because the frontend
        // file selection doesnt know that ".log" files are text/plain
        // and therefore defaults to application/ocet-stream
        if (file.type !== textPlainContentType
            && file.type !== ocetStreamContentType
        ) {
            error(400, {
                message: `Invalid file type: ${file.type || '<None>'}`,
            });
        }

        const fileContent = await file.text();
        const output = analyzeLog(fileContent);

        // only say file is incomplete if not a single property was read successfully
        if (Object.values(output.meta).filter(e => e !== null).length === 0) {
            error(400, {
                message: 'Incomplete file',
            });
        }

        const id = randomUUID();

        if (storageEnabled) {
            const command = new PutObjectCommand({
                Bucket: env.STORAGE_BUCKET,
                Key: `${output.meta.buildVersion}/${output.meta.platform || 'UnknownPlatform'}/${id}.txt`,
                Body: fileContent,
                ContentType: textPlainContentType,
                Metadata: {
                    'name': file.name,
                },
            });

            if (output.meta.buildVersion) {
                command.input.Metadata!['build-version'] = output.meta.buildVersion;
            }

            if (output.meta.engineVersion) {
                command.input.Metadata!['engine-version'] = output.meta.engineVersion;
            }

            if (output.meta.platform) {
                command.input.Metadata!['platform'] = output.meta.platform;
            }

            if (output.meta.branch) {
                command.input.Metadata!['branch'] = output.meta.branch;
            }

            if (output.meta.executableName) {
                command.input.Metadata!['exectable-name'] = output.meta.executableName;
            }

            const object = await storage.send(command, {
                requestTimeout: 15 * 1000,
            });

            console.debug(object);
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