import { npm_package_repository_type, npm_package_repository_url } from "$env/static/private";
import { storageEnabled } from "$lib/server/storage";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    return {
        storageEnabled,
        repository: npm_package_repository_url
            .replace(`${npm_package_repository_type}+`, ''),
    }
};