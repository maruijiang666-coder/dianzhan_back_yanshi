import client from "./client";

export const listContracts = (params?: { brandId?: number; landlordId?: number; contractType?: string; keyword?: string }) =>
  client.get("/contracts", { params }).then(r => r.data);

export const createContract = (data: any) =>
  client.post("/contracts", data).then(r => r.data);

export const updateContract = (id: number, data: any) =>
  client.put(`/contracts/${id}`, data).then(r => r.data);

export const deleteContract = (id: number) =>
  client.delete(`/contracts/${id}`).then(r => r.data);
