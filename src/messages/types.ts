export type CheckStepId =
  | "env"
  | "repo"
  | "permissions"
  | "branch"
  | "domain_file"
  | "ip_file";

export type StepStatus = "pending" | "running" | "done" | "failed";

export type Step = {
  id: CheckStepId;
  label: string;
  status: StepStatus;
};

export type CheckProgressCallback = (
  step: CheckStepId,
  status: "start" | "done" | "fail",
) => void;

export type RunAccessChecksOptions = {
  preserveSession?: boolean;
};
