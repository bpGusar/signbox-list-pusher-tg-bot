import axios from "axios";
import { FileTooLargeError } from "../github/files";

function isApiErrorBody(data: unknown): data is { message: unknown } {
  return typeof data === "object" && data !== null && "message" in data;
}

export function getApiErrorMessage(data: unknown): string | undefined {
  if (!isApiErrorBody(data)) {
    return undefined;
  }

  return typeof data.message === "string" ? data.message : undefined;
}

export function getErrorReason(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const apiMessage = getApiErrorMessage(error.response?.data);

    if (status && apiMessage) {
      return `HTTP ${status}: ${apiMessage}`;
    }

    if (status) {
      return `HTTP ${status}`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isFileTooLargeError(
  error: unknown,
): error is FileTooLargeError {
  return error instanceof FileTooLargeError;
}

export function getFileTooLargeDetails(
  error: unknown,
): { path: string; sizeBytes: number } | null {
  if (!isFileTooLargeError(error)) {
    return null;
  }

  return { path: error.path, sizeBytes: error.sizeBytes };
}

export function isGithubAuthError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status === 401 || status === 403;
}
