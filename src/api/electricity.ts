import client from "./client";

export const listElectricity = (params?: { stationId?: number; period?: string }) =>
  client.get("/electricity", { params }).then(r => r.data);

export const getElectricity = (id: number) =>
  client.get(`/electricity/${id}`).then(r => r.data);

export const listPeriods = () =>
  client.get("/electricity/periods").then(r => r.data);

export const createElectricity = (data: any) =>
  client.post("/electricity", data).then(r => r.data);

export const updateElectricity = (id: number, data: any) =>
  client.put(`/electricity/${id}`, data).then(r => r.data);

export const deleteElectricity = (id: number) =>
  client.delete(`/electricity/${id}`).then(r => r.data);
