import * as https from 'https';
import * as http from 'http';
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
export class HttpClient {
  private baseUrl: string;
  private token?: string;
  private ignoreCertErrors: boolean;
  private logger: Logger;

  constructor(options: HttpClientOptions, logger: Logger) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = options.token;
    this.ignoreCertErrors = options.ignoreCertErrors;
    this.logger = logger;
  }

  /**
   * Make HTTP request
   */
  async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<HttpResponse> {
    const url = `${this.baseUrl}${path}`;
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: Record<string, string> = {
      'User-Agent': 'git-action-tag-info',
      Accept: 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const options: https.RequestOptions | http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
    };

    // Ignore certificate errors if requested (HTTPS only)
    if (isHttps && this.ignoreCertErrors) {
      (options as https.RequestOptions).rejectUnauthorized = false;
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

    return new Promise<HttpResponse>((resolve, reject) => {
      const req = client.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          const response: HttpResponse = {
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
            } catch {
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
  async get(path: string): Promise<HttpResponse> {
    return this.request('GET', path);
  }

  /**
   * POST request
   */
  async post(path: string, body?: unknown): Promise<HttpResponse> {
    return this.request('POST', path, body);
  }

  /**
   * DELETE request
   */
  async delete(path: string): Promise<HttpResponse> {
    return this.request('DELETE', path);
  }
}
