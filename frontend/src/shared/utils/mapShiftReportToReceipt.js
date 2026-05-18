/** Maps owner shift-report API payload (MongoDB ShiftReport) to attendant receipt UI / PDF shape. */

export const formatShiftTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatReportDate = (value) => {
  if (!value) return new Date().toLocaleDateString();
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date().toLocaleDateString();
  return date.toLocaleDateString();
};

/**
 * @param {object} apiReport — GET /api/owner/shift-reports/:reportId response
 */
export const mapOwnerShiftReportToReceipt = (apiReport) => {
  const reconciliation = apiReport?.reconciliation ?? {};
  const totals = apiReport?.totals ?? {};
  const closedAt = apiReport?.shift?.closedAt ?? apiReport?.generatedAt;

  return {
    id: apiReport?.reportId ?? "--",
    date: formatReportDate(closedAt),
    startTime: formatShiftTime(apiReport?.shift?.startedAt),
    endTime: formatShiftTime(apiReport?.shift?.closedAt),
    branchName: apiReport?.branch?.name ?? "Branch",
    operatorName: apiReport?.attendant?.name ?? "--",
    expected: Number(reconciliation?.expected ?? totals?.expectedCashInHand ?? 0),
    actual: Number(reconciliation?.submitted ?? totals?.submittedCashInHand ?? 0),
    variance: Number(reconciliation?.variance ?? totals?.cashDifference ?? 0),
    status: reconciliation?.status ?? "EXACT MATCH",
    transactions:
      Number(totals?.totalWalkUps ?? 0) + Number(totals?.totalTransactions ?? 0),
    _source: apiReport?.source ?? null,
  };
};
