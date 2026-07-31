import client from "./client";

// 品牌方
export const listBrands = () => client.get("/directory/brands").then(r => r.data);
export const createBrand = (data: any) => client.post("/directory/brands", data).then(r => r.data);
export const updateBrand = (id: number, data: any) => client.put(`/directory/brands/${id}`, data).then(r => r.data);
export const deleteBrand = (id: number) => client.delete(`/directory/brands/${id}`).then(r => r.data);

// 公司主体
export const listEntities = () => client.get("/directory/entities").then(r => r.data);
export const createEntity = (data: any) => client.post("/directory/entities", data).then(r => r.data);
export const updateEntity = (id: number, data: any) => client.put(`/directory/entities/${id}`, data).then(r => r.data);
export const deleteEntity = (id: number) => client.delete(`/directory/entities/${id}`).then(r => r.data);

// 场地方
export const listLandlords = () => client.get("/directory/landlords").then(r => r.data);
export const createLandlord = (data: any) => client.post("/directory/landlords", data).then(r => r.data);
export const updateLandlord = (id: number, data: any) => client.put(`/directory/landlords/${id}`, data).then(r => r.data);
export const deleteLandlord = (id: number) => client.delete(`/directory/landlords/${id}`).then(r => r.data);

// 股东
export const listShareholders = () => client.get("/directory/shareholders").then(r => r.data);
export const createShareholder = (data: any) => client.post("/directory/shareholders", data).then(r => r.data);
export const updateShareholder = (id: number, data: any) => client.put(`/directory/shareholders/${id}`, data).then(r => r.data);
export const deleteShareholder = (id: number) => client.delete(`/directory/shareholders/${id}`).then(r => r.data);

// 介绍人
export const listIntroducers = () => client.get("/directory/introducers").then(r => r.data);
export const createIntroducer = (data: any) => client.post("/directory/introducers", data).then(r => r.data);
export const updateIntroducer = (id: number, data: any) => client.put(`/directory/introducers/${id}`, data).then(r => r.data);
export const deleteIntroducer = (id: number) => client.delete(`/directory/introducers/${id}`).then(r => r.data);
