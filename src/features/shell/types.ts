export type StepDef = { id: number; label: string };

export type ShellFooter = {
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** 다음으로 못 넘어가는 이유를 사용자에게 알리는 문장 */
  hint?: string;
};
