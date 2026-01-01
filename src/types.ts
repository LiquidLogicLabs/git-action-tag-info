/**
 * Supported Git hosting platforms
 */
export enum Platform {
  GITHUB = 'github',
  GITEA = 'gitea',
  BITBUCKET = 'bitbucket',
}

/**
 * Item type enumeration
 */
export enum ItemType {
  COMMIT = 'commit', // Lightweight tag
  TAG = 'tag', // Annotated tag
  RELEASE = 'release', // Platform release
}

/**
 * Tag type enumeration (deprecated - use ItemType)
 * @deprecated Use ItemType instead. TagType.COMMIT maps to ItemType.COMMIT, TagType.ANNOTATED maps to ItemType.TAG.
 */
export enum TagType {
  COMMIT = 'commit',
  ANNOTATED = 'annotated',
}

/**
 * Item information structure (unified for tags and releases)
 */
export interface ItemInfo {
  exists: boolean;
  name: string; // Tag name or release tag name
  item_sha: string; // Tag SHA or release associated tag SHA
  item_type: ItemType; // commit, tag, or release
  commit_sha: string; // Commit SHA
  details: string; // Tag message or release body
  verified: boolean; // Whether tag is verified (tags only, false for releases)
  is_draft: boolean; // Whether release is a draft (releases only, false for tags)
  is_prerelease: boolean; // Whether release is a prerelease (releases only, false for tags)
}

/**
 * Tag information structure (deprecated - use ItemInfo)
 * @deprecated Use ItemInfo instead. Kept as alias for backward compatibility.
 */
export type TagInfo = ItemInfo;

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

