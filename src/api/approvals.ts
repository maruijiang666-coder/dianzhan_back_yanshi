import client from "./client";

export const listFlows = () =>
  client.get("/approvals/flows").then(r => r.data);

export const saveFlow = (data: any) =>
  client.post("/approvals/flows", data).then(r => r.data);

export const listApprovals = (params?: { bizType?: string; status?: string; applicant?: string }) =>
  client.get("/approvals", { params }).then(r => r.data);

export const getApproval = (id: number) =>
  client.get(`/approvals/${id}`).then(r => r.data);

export const createApproval = (data: any) =>
  client.post("/approvals", data).then(r => r.data);

export const actOnApproval = (id: number, data: any) =>
  client.post(`/approvals/${id}/act`, data).then(r => r.data);

export const getApprovalStats = () =>
  client.get("/approvals/stats/overview").then(r => r.data);

// 分红审批
export const submitDividendApproval = (data: {
  dividendRecordId: number; stationName: string; period: string; amount: number;
  applicant: string; approvers?: { finance_supervisor?: string; boss?: string };
}) =>
  client.post("/approvals", {
    bizType: "分红审批",
    title: `${data.stationName} ${data.period} 分红审批`,
    applicant: data.applicant,
    amount: data.amount,
    reason: `${data.stationName} ${data.period} 分红，金额 ${data.amount} 元`,
    dividendRecordId: data.dividendRecordId,
    approvers: data.approvers,
  }).then(r => r.data);

export const getApprovalByDividend = (dividendId: number) =>
  client.get(`/approvals/by-dividend/${dividendId}`).then(r => r.data);
