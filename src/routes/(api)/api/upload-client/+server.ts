import { error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { npm_package_version } from "$env/static/private";

interface WorkflowRunsData {
    workflow_runs: {
        id: number;
    }[];
}

interface WorkflowRunArtifactsData {
    artifacts: {
        id: number;
        name: string;
        expired: boolean;
    }[];
}

interface DownloadCache {
    url: string;
    expires: number;
}

let cache: DownloadCache | null = null;
const headers = {
    'User-Agent': `fn-logs-api/${npm_package_version}`,
};

export const GET: RequestHandler = async () => {
    try {
        if (!env.GH_UPLOADER_CLIENT_USER || !env.GH_UPLOADER_CLIENT_REPO) {
            error(400, { message: 'fn logs client gh is not configured' });
        }

        if (cache && cache.expires > Date.now()) {
            return new Response(cache.url);
        }

        const baseUserRepo = `${encodeURIComponent(env.GH_UPLOADER_CLIENT_USER)}/${encodeURIComponent(env.GH_UPLOADER_CLIENT_REPO)}`;
        const baseUrl = `https://api.github.com/repos/${baseUserRepo}`;
        const workflowRunsResponse = await fetch(`${baseUrl}/actions/runs?per_page=1&status=completed`, { headers });

        if (!workflowRunsResponse.ok) {
            error(500, { message: `Fetching GH workflow runs failed with status ${workflowRunsResponse.status} ${workflowRunsResponse.statusText} ${await workflowRunsResponse.text()}` });
        }

        const workflowRunsData: WorkflowRunsData = await workflowRunsResponse.json();
        const workflowRun = workflowRunsData.workflow_runs[0];

        if (!workflowRun) {
            error(500, { message: `It looks likes a download is not available yet` });
        }

        const workflowRunArtifactsResponse = await fetch(`${baseUrl}/actions/runs/${workflowRun.id}/artifacts`, { headers });

        if (!workflowRunArtifactsResponse.ok) {
            error(500, { message: `Fetching GH workflow run ${workflowRun.id} artifacts failed with status ${workflowRunArtifactsResponse.status} ${workflowRunArtifactsResponse.statusText} ${await workflowRunArtifactsResponse.text()}` });
        }

        const artifactsData: WorkflowRunArtifactsData = await workflowRunArtifactsResponse.json();
        const artifact = artifactsData.artifacts.find((artifact) => artifact.name === 'fn-logs-client');

        if (!artifact) {
            error(500, { message: `It looks likes a artifact is not available yet` });
        }

        if (artifact.expired) {
            error(500, { message: `It looks like the artifact has expired` });
        }

        cache = {
            url: `https://github.com/${baseUserRepo}/actions/runs/${workflowRun.id}/artifacts/${artifact.id}`,
            expires: Date.now() + 5 * 60 * 1000, // 5min
        };

        return new Response(cache.url);
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