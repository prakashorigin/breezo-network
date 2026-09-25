export function isTimestampFresh(timestampMs: number, nowMs: number, toleranceMs: number) {
  return Number.isSafeInteger(timestampMs) && Math.abs(nowMs - timestampMs) <= toleranceMs;
}
export function isSequenceAcceptable(lastAccepted: number, incoming: number) {
  return Number.isSafeInteger(incoming) && incoming > lastAccepted;
}
export function shouldIssueContributionReward(acceptedReadings: number, threshold = 50) {
  return acceptedReadings > 0 && acceptedReadings % threshold === 0;
}
