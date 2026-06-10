import type { DuplicateResolutionStrategy } from "../const/types";
import type { EntryType } from "../utils/types";

export type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export type AccessCheckResult =
  | { status: "ok"; repo: string; branch: string }
  | { status: "env_missing" }
  | { status: "unauthorized" }
  | { status: "repo_not_found" }
  | { status: "forbidden" }
  | { status: "no_push" }
  | { status: "branch_not_found"; branch: string }
  | { status: "unknown"; message: string };

export type RepoPermissions = {
  push?: boolean;
  admin?: boolean;
  maintain?: boolean;
};

export type RepoResponse = {
  permissions?: RepoPermissions;
};

export type ListFilesCheckResult = {
  domainListExists: boolean;
  ipListExists: boolean;
  allExist: boolean;
};

export type GithubFile = {
  sha: string;
  content: string;
};

export type GithubContentsResponse = {
  sha: string;
  content: string;
  size: number;
  encoding: string;
};

export type GithubUpdateResponse = {
  content: {
    sha: string;
  };
  commit: {
    sha: string;
  };
};

export type DuplicateGroup = {
  value: string;
  lines: string[];
};

export type ListDuplicatesReport = {
  fileName: string;
  type: EntryType;
  groups: DuplicateGroup[];
};

export type ResolveListDuplicatesResult =
  | { status: "file_not_found"; fileName: string }
  | { status: "no_duplicates"; fileName: string }
  | {
      status: "resolved";
      fileName: string;
      removedCount: number;
      strategy: DuplicateResolutionStrategy;
    };

export type DuplicatesInFileResult = {
  status: "duplicates_in_file";
  fileName: string;
  type: EntryType;
  groups: DuplicateGroup[];
};

export type AddToListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | {
      status: "already_exists";
      fileName: string;
      value: string;
      type: EntryType;
    }
  | {
      status: "added";
      fileName: string;
      value: string;
      type: EntryType;
      changes: string[];
    };

export type AddManyToListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | {
      status: "all_exist";
      fileName: string;
      type: EntryType;
      skipped: string[];
      disabledInFile: string[];
    }
  | {
      status: "added";
      fileName: string;
      type: EntryType;
      added: string[];
      skipped: string[];
      disabledInFile: string[];
      changes: string[];
    };

export type ModifyManyInListResult =
  | { status: "file_not_found"; fileName: string }
  | DuplicatesInFileResult
  | {
      status: "no_changes";
      fileName: string;
      type: EntryType;
      skipped: string[];
      notFound: string[];
    }
  | {
      status: "modified";
      fileName: string;
      type: EntryType;
      affected: string[];
      skipped: string[];
      notFound: string[];
      changes: string[];
    };
