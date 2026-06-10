import axios from "axios";
import { getGithubApi, getGithubEnv } from "./client";

export const MAX_CONTENTS_FILE_SIZE = 1024 * 1024;

export class FileTooLargeError extends Error {
  readonly path: string;
  readonly sizeBytes: number;

  constructor(path: string, sizeBytes: number) {
    super(`File ${path} exceeds GitHub Contents API limit (${sizeBytes} bytes)`);
    this.name = "FileTooLargeError";
    this.path = path;
    this.sizeBytes = sizeBytes;
  }
}

export type GithubFile = {
  sha: string;
  content: string;
};

type GithubContentsResponse = {
  sha: string;
  content: string;
  size: number;
  encoding: string;
};

type GithubUpdateResponse = {
  content: {
    sha: string;
  };
  commit: {
    sha: string;
  };
};

export function assertContentSize(path: string, content: string): void {
  const sizeBytes = Buffer.byteLength(content, "utf8");

  if (sizeBytes > MAX_CONTENTS_FILE_SIZE) {
    throw new FileTooLargeError(path, sizeBytes);
  }
}

export async function getFileIfExists(
  path: string,
): Promise<GithubFile | null> {
  try {
    return await getFile(path);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getFile(path: string): Promise<GithubFile> {
  const api = getGithubApi();
  const { owner, repo, branch } = getGithubEnv();

  const { data } = await api.get<GithubContentsResponse>(
    `/repos/${owner}/${repo}/contents/${path}`,
    { params: { ref: branch } },
  );

  if (data.size === 0) {
    return { sha: data.sha, content: "" };
  }

  if (data.size > MAX_CONTENTS_FILE_SIZE) {
    throw new FileTooLargeError(path, data.size);
  }

  if (data.encoding === "none" || !data.content) {
    throw new FileTooLargeError(path, data.size);
  }

  const content = Buffer.from(data.content, "base64").toString("utf8");
  assertContentSize(path, content);

  return {
    sha: data.sha,
    content,
  };
}

export async function updateFile(
  path: string,
  content: string,
  sha: string,
  message: string,
) {
  assertContentSize(path, content);

  const api = getGithubApi();
  const { owner, repo, branch } = getGithubEnv();

  const { data } = await api.put<GithubUpdateResponse>(
    `/repos/${owner}/${repo}/contents/${path}`,
    {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
      branch,
    },
  );

  return data;
}
