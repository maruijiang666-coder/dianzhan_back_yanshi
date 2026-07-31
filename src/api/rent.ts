import client from "./client";

// 场租付款合同
export const listLeases = (params?: { stationId?: number }) =>
  client.get("/rent/leases", { params }).then(r => r.data);

export const createLease = (data: any) =>
  client.post("/rent/leases", data).then(r => r.data);

export const updateLease = (id: number, data: any) =>
  client.put(`/rent/leases/${id}`, data).then(r => r.data);

export const deleteLease = (id: number) =>
  client.delete(`/rent/leases/${id}`).then(r => r.data);

// 场租收款合同
export const listIncomes = (params?: { stationId?: number; brandId?: number }) =>
  client.get("/rent/incomes", { params }).then(r => r.data);

export const createIncome = (data: any) =>
  client.post("/rent/incomes", data).then(r => r.data);

export const updateIncome = (id: number, data: any) =>
  client.put(`/rent/incomes/${id}`, data).then(r => r.data);

export const deleteIncome = (id: number) =>
  client.delete(`/rent/incomes/${id}`).then(r => r.data);

// 租金分期收款
export const listReceipts = (params?: { rentIncomeId?: number }) =>
  client.get("/rent/receipts", { params }).then(r => r.data);

export const createReceipt = (data: any) =>
  client.post("/rent/receipts", data).then(r => r.data);

export const updateReceipt = (id: number, data: any) =>
  client.put(`/rent/receipts/${id}`, data).then(r => r.data);

export const deleteReceipt = (id: number) =>
  client.delete(`/rent/receipts/${id}`).then(r => r.data);

// 运营费用
export const listExpenses = (params?: { stationId?: number; period?: string }) =>
  client.get("/rent/expenses", { params }).then(r => r.data);

export const saveExpense = (data: any) =>
  client.post("/rent/expenses", data).then(r => r.data);

export const deleteExpense = (id: number) =>
  client.delete(`/rent/expenses/${id}`).then(r => r.data);
