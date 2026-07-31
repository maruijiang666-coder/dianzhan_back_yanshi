import client from "./client";

export const listMeters = (params?: { stationId?: number; brandId?: number }) =>
  client.get("/meters", { params }).then(r => r.data);

export const getMeter = (id: number) =>
  client.get(`/meters/${id}`).then(r => r.data);

export const createMeter = (data: any) =>
  client.post("/meters", data).then(r => r.data);

export const updateMeter = (id: number, data: any) =>
  client.put(`/meters/${id}`, data).then(r => r.data);

export const deleteMeter = (id: number) =>
  client.delete(`/meters/${id}`).then(r => r.data);
