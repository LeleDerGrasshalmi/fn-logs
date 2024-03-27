import { npm_package_repository_type, npm_package_repository_url } from "$env/static/private";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    return {
        repository: npm_package_repository_url
            .replace(`${npm_package_repository_type}+`, ''),
    }
};