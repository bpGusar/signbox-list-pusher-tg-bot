import axios from "axios";

function isApiErrorBody(data: unknown): data is { message: unknown } {
  return typeof data === "object" && data !== null && "message" in data;
}

function getApiErrorMessage(data: unknown): string | undefined {
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
