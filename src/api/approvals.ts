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
