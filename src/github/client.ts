import axios, { type AxiosInstance } from "axios";

type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

let githubApi: AxiosInstance | undefined;

function getGithubConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_USERNAME;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub env vars missing: GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO",
    );
  }

  return { token, owner, repo, branch };
}

export function getGithubApi(): AxiosInstance {
  if (!githubApi) {
    const { token } = getGithubConfig();
    githubApi = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }

  return githubApi;
}

export function getGithubEnv(): Omit<GithubConfig, "token"> {
  const { owner, repo, branch } = getGithubConfig();
  return { owner, repo, branch };
}
