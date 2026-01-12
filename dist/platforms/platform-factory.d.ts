import { Platform, RepositoryInfo, PlatformAPI } from '../types';
import { Logger } from '../logger';
export declare function createPlatformAPI(repoInfo: RepositoryInfo, explicitPlatform: Platform | 'auto' | undefined, config: {
    token?: string;
    baseUrl?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
}, logger: Logger): Promise<{
    platform: Platform;
    api: PlatformAPI;
    baseUrl?: string;
}>;
//# sourceMappingURL=platform-factory.d.ts.map