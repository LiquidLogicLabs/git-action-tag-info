/**
 * Supported Git hosting platforms
 */
export enum Platform {
  GITHUB = 'github',
  GITEA = 'gitea',
  BITBUCKET = 'bitbucket',
}

/**
 * Tag type enumeration
 */
export enum TagType {
  COMMIT = 'commit',
  ANNOTATED = 'annotated',
}

/**
 * Tag information structure
 */
export interface TagInfo {
  exists: boolean;
  tag_name: string;
  tag_sha: string;
  tag_type: TagType;
  commit_sha: string;
  tag_message: string;
  verified: boolean;
}

/**
 * Repository configuration
 */
export interface RepoConfig {
  type: 'local' | 'remote';
  platform?: Platform;
  owner?: string;
  repo?: string;
  baseUrl?: string;
  path?: string;
  token?: string;
  ignoreCertErrors?: boolean;
  tagFormat?: string;
}

/**
 * HTTP response structure for API calls
 */
export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

