import axios from "axios";
import { getGithubApi, getGithubEnv } from "./client";

export type GithubFile = {
  sha: string;
  content: string;
};

type GithubContentsResponse = {
  sha: string;
  content: string;
};

type GithubUpdateResponse = {
  content: {
    sha: string;
  };
  commit: {
    sha: string;
  };
};

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

  return {
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf8"),
  };
}

export async function updateFile(
  path: string,
  content: string,
  sha: string,
  message: string,
) {
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
