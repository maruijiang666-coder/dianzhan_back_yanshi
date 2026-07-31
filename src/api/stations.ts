import client from "./client";

export const listStations = (params?: { landlordId?: number; keyword?: string }) =>
  client.get("/stations", { params }).then(r => r.data);

export const getStation = (id: number) =>
  client.get(`/stations/${id}`).then(r => r.data);

export const createStation = (data: any) =>
  client.post("/stations", data).then(r => r.data);

export const updateStation = (id: number, data: any) =>
  client.put(`/stations/${id}`, data).then(r => r.data);

export const deleteStation = (id: number) =>
  client.delete(`/stations/${id}`).then(r => r.data);
