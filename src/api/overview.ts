import client from "./client";

export const getOverview = () =>
  client.get("/overview").then(r => r.data);

export const getStationBoard = (params?: { landlordId?: number; keyword?: string; period?: string }) =>
  client.get("/overview/station-board", { params }).then(r => r.data);

export const getShareholderBoard = () =>
  client.get("/overview/shareholder-board").then(r => r.data);
