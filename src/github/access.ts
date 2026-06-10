import axios from "axios";
import { DOMAIN_LIST_FILE, IP_LIST_FILE } from "../const/files";
import type { CheckProgressCallback } from "../messages/checkProgress";
import { getGithubApi, getGithubEnv } from "./client";
import { getFileIfExists } from "./files";

export type AccessCheckResult =
  | { status: "ok"; repo: string; branch: string }
  | { status: "env_missing" }
  | { status: "unauthorized" }
  | { status: "repo_not_found" }
  | { status: "forbidden" }
  | { status: "no_push" }
  | { status: "branch_not_found"; branch: string }
  | { status: "unknown"; message: string };

type RepoPermissions = {
  push?: boolean;
  admin?: boolean;
  maintain?: boolean;
};

type RepoResponse = {
  permissions?: RepoPermissions;
};

function mapAxiosError(error: unknown): AccessCheckResult | null {
  if (!axios.isAxiosError(error)) return null;

  const status = error.response?.status;

  if (status === 401) return { status: "unauthorized" };
  if (status === 404) return { status: "repo_not_found" };
  if (status === 403) return { status: "forbidden" };

  return { status: "unknown", message: error.message };
}

function report(
  onProgress: CheckProgressCallback | undefined,
  step: Parameters<CheckProgressCallback>[0],
  status: Parameters<CheckProgressCallback>[1],
): void {
  onProgress?.(step, status);
}

export async function checkRepositoryAccess(
  onProgress?: CheckProgressCallback,
): Promise<AccessCheckResult> {
  report(onProgress, "env", "start");

  let owner: string;
  let repo: string;
  let branch: string;

  try {
    ({ owner, repo, branch } = getGithubEnv());
    report(onProgress, "env", "done");
  } catch (error) {
    report(onProgress, "env", "fail");

    if (
      error instanceof Error &&
      error.message.includes("GitHub env vars missing")
    ) {
      return { status: "env_missing" };
    }

    return {
      status: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const api = getGithubApi();

  report(onProgress, "repo", "start");

  let repoData: RepoResponse;

  try {
    const { data } = await api.get<RepoResponse>(`/repos/${owner}/${repo}`);
    repoData = data;
    report(onProgress, "repo", "done");
  } catch (error) {
    report(onProgress, "repo", "fail");
    return mapAxiosError(error) ?? {
      status: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  report(onProgress, "permissions", "start");

  const canWrite =
    repoData.permissions?.push ||
    repoData.permissions?.admin ||
    repoData.permissions?.maintain;

  if (!canWrite) {
    report(onProgress, "permissions", "fail");
    return { status: "no_push" };
  }

  report(onProgress, "permissions", "done");
  report(onProgress, "branch", "start");

  try {
    await api.get(`/repos/${owner}/${repo}/branches/${branch}`);
    report(onProgress, "branch", "done");
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      report(onProgress, "branch", "fail");
      return { status: "branch_not_found", branch };
    }

    report(onProgress, "branch", "fail");
    return mapAxiosError(error) ?? {
      status: "unknown",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return { status: "ok", repo: `${owner}/${repo}`, branch };
}

export type ListFilesCheckResult = {
  domainListExists: boolean;
  ipListExists: boolean;
  allExist: boolean;
};

export async function checkListFilesExistence(
  onProgress?: CheckProgressCallback,
): Promise<ListFilesCheckResult> {
  report(onProgress, "domain_file", "start");
  const domainFile = await getFileIfExists(DOMAIN_LIST_FILE);
  report(
    onProgress,
    "domain_file",
    domainFile !== null ? "done" : "fail",
  );

  report(onProgress, "ip_file", "start");
  const ipFile = await getFileIfExists(IP_LIST_FILE);
  report(onProgress, "ip_file", ipFile !== null ? "done" : "fail");

  const domainListExists = domainFile !== null;
  const ipListExists = ipFile !== null;

  return {
    domainListExists,
    ipListExists,
    allExist: domainListExists && ipListExists,
  };
}
