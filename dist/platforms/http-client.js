"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
/**
 * HTTP client for making requests to platform APIs
 */
class HttpClient {
    baseUrl;
    token;
    ignoreCertErrors;
    logger;
    constructor(options, logger) {
        this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.token = options.token;
        this.ignoreCertErrors = options.ignoreCertErrors;
        this.logger = logger;
    }
    /**
     * Make HTTP request
     */
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        const headers = {
            'User-Agent': 'git-action-tag-info',
            Accept: 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }
        if (body) {
            headers['Content-Type'] = 'application/json';
        }
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
        };
        // Ignore certificate errors if requested (HTTPS only)
        if (isHttps && this.ignoreCertErrors) {
            options.rejectUnauthorized = false;
        }
        // Log request if verbose
        if (this.logger.verbose) {
            const sanitizedHeaders = { ...headers };
            if (sanitizedHeaders.Authorization) {
                sanitizedHeaders.Authorization = '***';
            }
            this.logger.debug(`HTTP ${method} ${url}`);
            this.logger.debug(`Headers: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
            if (body) {
                this.logger.debug(`Body: ${JSON.stringify(body, null, 2)}`);
            }
        }
        return new Promise((resolve, reject) => {
            const req = client.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                res.on('end', () => {
                    const response = {
                        statusCode: res.statusCode || 0,
                        headers: res.headers,
                        body: responseBody,
                    };
                    // Log response if verbose
                    if (this.logger.verbose) {
                        this.logger.debug(`HTTP Response: ${response.statusCode} ${res.statusMessage || ''}`);
                        try {
                            const parsedBody = JSON.parse(responseBody);
                            this.logger.debug(`Response body: ${JSON.stringify(parsedBody, null, 2)}`);
                        }
                        catch {
                            this.logger.debug(`Response body: ${responseBody.substring(0, 200)}...`);
                        }
                    }
                    resolve(response);
                });
            });
            req.on('error', (error) => {
                if (this.logger.verbose) {
                    this.logger.debug(`Request error: ${error.message}`);
                }
                reject(error);
            });
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
    /**
     * GET request
     */
    async get(path) {
        return this.request('GET', path);
    }
    /**
     * POST request
     */
    async post(path, body) {
        return this.request('POST', path, body);
    }
    /**
     * DELETE request
     */
    async delete(path) {
        return this.request('DELETE', path);
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map