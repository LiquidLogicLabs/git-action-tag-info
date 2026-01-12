import { HttpResponse } from '../types';
import { Logger } from '../logger';
/**
 * HTTP client options
 */
export interface HttpClientOptions {
    baseUrl: string;
    token?: string;
    ignoreCertErrors: boolean;
    verbose: boolean;
}
/**
 * HTTP client for making requests to platform APIs
 */
export declare class HttpClient {
    private baseUrl;
    private token?;
    private ignoreCertErrors;
    private logger;
    constructor(options: HttpClientOptions, logger: Logger);
    /**
     * Make HTTP request
     */
    request(method: string, path: string, body?: unknown): Promise<HttpResponse>;
    /**
     * GET request
     */
    get(path: string): Promise<HttpResponse>;
    /**
     * POST request
     */
    post(path: string, body?: unknown): Promise<HttpResponse>;
    /**
     * DELETE request
     */
    delete(path: string): Promise<HttpResponse>;
}
//# sourceMappingURL=http-client.d.ts.map