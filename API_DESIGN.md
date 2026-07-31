# 换电站经营管理平台 - 接口设计文档

## 目录

1. [基础档案管理](#1-基础档案管理)
2. [电表管理](#2-电表管理)
3. [站点管理](#3-站点管理)
4. [分红配置管理](#4-分红配置管理)
5. [运营费用管理](#5-运营费用管理)
6. [电费台账管理](#6-电费台账管理)
7. [场地租金管理](#7-场地租金管理)
8. [分红计算与管理](#8-分红计算与管理)
9. [看板与汇总](#9-看板与汇总)
10. [审批管理](#10-审批管理)
11. [合同管理](#11-合同管理)

---

## 1. 基础档案管理

### 1.1 品牌方

#### 获取品牌方列表
```
GET /api/trpc/ledger.brands
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "美团",
      "contact": "张经理",
      "remark": "全国合作品牌",
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 创建品牌方
```
POST /api/trpc/mut.createBrand
```

**请求：**
```json
{
  "name": "美团",
  "contact": "张经理",
  "remark": "全国合作品牌"
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 更新品牌方
```
POST /api/trpc/mut.updateBrand
```

**请求：**
```json
{
  "id": 1,
  "name": "美团",
  "contact": "张经理",
  "remark": "备注更新"
}
```

#### 删除品牌方
```
POST /api/trpc/mut.deleteBrand
```

**请求：**
```json
{
  "id": 1
}
```

---

### 1.2 公司主体

#### 获取公司主体列表
```
GET /api/trpc/ledger.entities
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "云南来换电新能源有限公司",
      "shortName": "来换电",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 创建公司主体
```
POST /api/trpc/mut.createEntity
```

**请求：**
```json
{
  "name": "云南来换电新能源有限公司",
  "shortName": "来换电",
  "remark": null
}
```

#### 更新公司主体
```
POST /api/trpc/mut.updateEntity
```

**请求：**
```json
{
  "id": 1,
  "name": "云南来换电新能源有限公司",
  "shortName": "来换电",
  "remark": null
}
```

#### 删除公司主体
```
POST /api/trpc/mut.deleteEntity
```

**请求：**
```json
{
  "id": 1
}
```

---

### 1.3 场地方/业主

#### 获取场地方列表
```
GET /api/trpc/ledger.landlords
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "五华区物业管理有限公司",
      "contact": "赵主任",
      "phone": "13800001111",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 创建场地方
```
POST /api/trpc/mut.createLandlord
```

**请求：**
```json
{
  "name": "五华区物业管理有限公司",
  "contact": "赵主任",
  "phone": "13800001111",
  "remark": null
}
```

#### 更新场地方
```
POST /api/trpc/mut.updateLandlord
```

**请求：**
```json
{
  "id": 1,
  "name": "五华区物业管理有限公司",
  "contact": "赵主任",
  "phone": "13800001111",
  "remark": null
}
```

#### 删除场地方
```
POST /api/trpc/mut.deleteLandlord
```

**请求：**
```json
{
  "id": 1
}
```

---

### 1.4 股东

#### 获取股东列表
```
GET /api/trpc/ledger.shareholders
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "陈总",
      "phone": "13900001111",
      "remark": "大股东",
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 创建股东
```
POST /api/trpc/mut.createShareholder
```

**请求：**
```json
{
  "name": "陈总",
  "phone": "13900001111",
  "remark": "大股东"
}
```

#### 更新股东
```
POST /api/trpc/mut.updateShareholder
```

**请求：**
```json
{
  "id": 1,
  "name": "陈总",
  "phone": "13900001111",
  "remark": "大股东"
}
```

#### 删除股东
```
POST /api/trpc/mut.deleteShareholder
```

**请求：**
```json
{
  "id": 1
}
```

---

### 1.5 介绍人

#### 获取介绍人列表
```
GET /api/trpc/ledger.introducers
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "张介绍",
      "phone": "13800001234",
      "remark": "负责五华区业务",
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 创建介绍人
```
POST /api/trpc/mut.createIntroducer
```

**请求：**
```json
{
  "name": "张介绍",
  "phone": "13800001234",
  "remark": "负责五华区业务"
}
```

#### 更新介绍人
```
POST /api/trpc/mut.updateIntroducer
```

**请求：**
```json
{
  "id": 1,
  "name": "张介绍",
  "phone": "13800001234",
  "remark": "负责五华区业务"
}
```

#### 删除介绍人
```
POST /api/trpc/mut.deleteIntroducer
```

**请求：**
```json
{
  "id": 1
}
```

---

## 2. 电表管理

### 获取电表列表
```
GET /api/trpc/ledger.meters?stationId=1&brandId=1
```

**参数：**
- `stationId` - 站点ID（可选）
- `brandId` - 品牌方ID（可选）

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "brandId": 1,
      "brandName": "美团",
      "meterNo": "M-001-01",
      "meterName": "美团1号电表",
      "status": "正常",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

### 获取电表详情
```
GET /api/trpc/ledger.meterDetail?id=1
```

**响应：**
```json
{
  "id": 1,
  "stationId": 1,
  "stationName": "五华站A",
  "brandId": 1,
  "brandName": "美团",
  "meterNo": "M-001-01",
  "meterName": "美团1号电表",
  "status": "正常",
  "remark": null,
  "createdAt": "2026-07-30T10:00:00Z",
  "realtime": {
    "totalKwh": 12500.50,
    "peakKwh": 3200.00,
    "sharpKwh": 2800.00,
    "flatKwh": 4500.00,
    "valleyKwh": 2000.50,
    "remainingAmount": 580.00,
    "readingAt": "2026-07-30T15:30:00Z"
  },
  "usage": {
    "today": 85.20,
    "thisMonth": 2150.30,
    "thisYear": 15800.50
  },
  "history": [
    {
      "reading": 12500.50,
      "readingAt": "2026-07-30T15:30:00Z",
      "source": "api"
    },
    {
      "reading": 12415.30,
      "readingAt": "2026-07-29T15:30:00Z",
      "source": "api"
    }
  ]
}
```

### 创建电表
```
POST /api/trpc/mut.createMeter
```

**请求：**
```json
{
  "stationId": 1,
  "brandId": 1,
  "meterNo": "M-001-01",
  "meterName": "美团1号电表",
  "remark": "主电表"
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 更新电表
```
POST /api/trpc/mut.updateMeter
```

**请求：**
```json
{
  "id": 1,
  "stationId": 1,
  "brandId": 1,
  "meterNo": "M-001-01",
  "meterName": "美团1号电表（主表）",
  "status": "正常",
  "remark": "更新备注"
}
```

### 删除电表
```
POST /api/trpc/mut.deleteMeter
```

**请求：**
```json
{
  "id": 1
}
```

---

## 3. 站点管理

### 获取站点列表
```
GET /api/trpc/ledger.stations?brandId=1&entityId=1&landlordId=1&keyword=五华
```

**参数：**
- `brandId` - 品牌方ID（可选）
- `entityId` - 公司主体ID（可选）
- `landlordId` - 场地方ID（可选）
- `keyword` - 关键词搜索（可选）

**响应：**
```json
{
  "items": [
    {
      "station": {
        "id": 1,
        "name": "五华站A",
        "code": "WH-001",
        "region": "五华区",
        "address": "五华区人民路100号",
        "landlordId": 1,
        "companyShare": 0.6,
        "status": "运营中",
        "remark": null,
        "createdAt": "2026-07-30T10:00:00Z"
      },
      "landlordName": "五华区物业管理有限公司",
      "meterCount": 2,
      "brandNames": ["美团", "哈啰"]
    }
  ]
}
```

### 获取站点详情
```
GET /api/trpc/ledger.stationDetail?id=1
```

**响应：**
```json
{
  "station": {
    "id": 1,
    "name": "五华站A",
    "code": "WH-001",
    "region": "五华区",
    "address": "五华区人民路100号",
    "landlordId": 1,
    "companyShare": 0.6,
    "status": "运营中",
    "remark": null,
    "createdAt": "2026-07-30T10:00:00Z"
  },
  "landlordName": "五华区物业管理有限公司",
  "meters": [
    {
      "id": 1,
      "brandId": 1,
      "brandName": "美团",
      "meterNo": "M-001-01",
      "meterName": "美团1号电表",
      "status": "正常"
    },
    {
      "id": 2,
      "brandId": 2,
      "brandName": "哈啰",
      "meterNo": "M-001-02",
      "meterName": "哈啰1号电表",
      "status": "正常"
    }
  ],
  "shareholderConfigs": [
    {
      "id": 1,
      "shareholderId": 1,
      "shareholderName": "陈总",
      "mode": "利润分红",
      "ratio": 0.3,
      "fixedAmount": null,
      "settlementPeriod": "月",
      "remark": null
    }
  ],
  "introducerConfigs": [
    {
      "id": 1,
      "introducerId": 1,
      "introducerName": "张介绍",
      "mode": "利润分红",
      "ratio": 0.1,
      "fixedAmount": null,
      "settlementPeriod": "月",
      "countAsCost": true,
      "remark": null
    }
  ],
  "latestElectricity": [
    {
      "id": 1,
      "period": "2026-07",
      "payKwh": 2500.00,
      "payAmount": 1625.00,
      "collectAmount": 3000.00,
      "profit": 1345.30,
      "payStatus": "未付款",
      "collectStatus": "未到账"
    }
  ],
  "leases": [
    {
      "id": 1,
      "contractStart": "2025-01-01",
      "contractEnd": "2027-12-31",
      "annualRent": 12000.00,
      "payMethod": "季付",
      "payAmount": 3000.00,
      "payStatus": "已付款"
    }
  ],
  "incomes": [
    {
      "id": 1,
      "contractStart": "2025-01-01",
      "contractEnd": "2027-12-31",
      "brandName": "美团",
      "unitMonthlyRent": 500.00,
      "cabinetsCount": 4,
      "monthlyRent": 2000.00,
      "annualIncome": 24000.00,
      "receipts": [
        {
          "id": 1,
          "seq": 1,
          "periodStart": "2025-01-01",
          "periodEnd": "2025-06-30",
          "amount": 12000.00,
          "status": "已到账"
        }
      ]
    }
  ]
}
```

### 创建站点
```
POST /api/trpc/mut.createStation
```

**请求：**
```json
{
  "name": "五华站A",
  "code": "WH-001",
  "region": "五华区",
  "address": "五华区人民路100号",
  "landlordId": 1,
  "companyShare": 0.6,
  "status": "运营中",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 更新站点
```
POST /api/trpc/mut.updateStation
```

**请求：**
```json
{
  "id": 1,
  "name": "五华站A",
  "code": "WH-001",
  "region": "五华区",
  "address": "五华区人民路100号",
  "landlordId": 1,
  "companyShare": 0.6,
  "status": "运营中",
  "remark": null
}
```

### 删除站点
```
POST /api/trpc/mut.deleteStation
```

**请求：**
```json
{
  "id": 1
}
```

---

## 4. 分红配置管理

### 4.1 股东分红配置

#### 获取站点的股东分红配置
```
GET /api/trpc/ledger.shareholderConfigs?stationId=1
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "shareholderId": 1,
      "shareholderName": "陈总",
      "mode": "利润分红",
      "ratio": 0.3,
      "fixedAmount": null,
      "settlementPeriod": "月",
      "remark": null
    },
    {
      "id": 2,
      "stationId": 1,
      "shareholderId": 2,
      "shareholderName": "刘总",
      "mode": "收入分红",
      "ratio": 0.1,
      "fixedAmount": null,
      "settlementPeriod": "月",
      "remark": null
    },
    {
      "id": 3,
      "stationId": 1,
      "shareholderId": 3,
      "shareholderName": "周总",
      "mode": "固定金额",
      "ratio": null,
      "fixedAmount": 500.00,
      "settlementPeriod": "季",
      "remark": null
    }
  ]
}
```

#### 保存股东分红配置
```
POST /api/trpc/mut.saveShareholderConfig
```

**请求（利润分红模式）：**
```json
{
  "stationId": 1,
  "shareholderId": 1,
  "mode": "利润分红",
  "ratio": 0.3,
  "fixedAmount": null,
  "settlementPeriod": "月",
  "remark": null
}
```

**请求（收入分红模式）：**
```json
{
  "stationId": 1,
  "shareholderId": 2,
  "mode": "收入分红",
  "ratio": 0.1,
  "fixedAmount": null,
  "settlementPeriod": "月",
  "remark": null
}
```

**请求（固定金额模式）：**
```json
{
  "stationId": 1,
  "shareholderId": 3,
  "mode": "固定金额",
  "ratio": null,
  "fixedAmount": 500.00,
  "settlementPeriod": "季",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 删除股东分红配置
```
POST /api/trpc/mut.deleteShareholderConfig
```

**请求：**
```json
{
  "id": 1
}
```

---

### 4.2 商务分红配置

#### 获取站点的商务分红配置
```
GET /api/trpc/ledger.introducerConfigs?stationId=1
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "introducerId": 1,
      "introducerName": "张介绍",
      "mode": "利润分红",
      "ratio": 0.1,
      "fixedAmount": null,
      "settlementPeriod": "月",
      "countAsCost": true,
      "remark": null
    },
    {
      "id": 2,
      "stationId": 1,
      "introducerId": 2,
      "introducerName": "李介绍",
      "mode": "固定金额",
      "ratio": null,
      "fixedAmount": 300.00,
      "settlementPeriod": "月",
      "countAsCost": false,
      "remark": null
    }
  ]
}
```

#### 保存商务分红配置
```
POST /api/trpc/mut.saveIntroducerConfig
```

**请求（利润分红，计入成本）：**
```json
{
  "stationId": 1,
  "introducerId": 1,
  "mode": "利润分红",
  "ratio": 0.1,
  "fixedAmount": null,
  "settlementPeriod": "月",
  "countAsCost": true,
  "remark": null
}
```

**请求（固定金额，不计入成本）：**
```json
{
  "stationId": 1,
  "introducerId": 2,
  "mode": "固定金额",
  "ratio": null,
  "fixedAmount": 300.00,
  "settlementPeriod": "月",
  "countAsCost": false,
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 删除商务分红配置
```
POST /api/trpc/mut.deleteIntroducerConfig
```

**请求：**
```json
{
  "id": 1
}
```

---

## 5. 运营费用管理

### 获取运营费用列表
```
GET /api/trpc/ledger.operatingExpenses?stationId=1&period=2026-07
```

**参数：**
- `stationId` - 站点ID（可选）
- `period` - 月份（可选，格式 YYYY-MM）

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "period": "2026-07",
      "amount": 500.00,
      "remark": "维护费200 + 保险300",
      "createdAt": "2026-07-30T10:00:00Z",
      "updatedAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

### 保存运营费用
```
POST /api/trpc/mut.saveOperatingExpense
```

**请求：**
```json
{
  "stationId": 1,
  "period": "2026-07",
  "amount": 500.00,
  "remark": "维护费200 + 保险300"
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 删除运营费用
```
POST /api/trpc/mut.deleteOperatingExpense
```

**请求：**
```json
{
  "id": 1
}
```

---

## 6. 电费台账管理

### 获取电费列表
```
GET /api/trpc/ledger.electricity?stationId=1&period=2026-07&brandId=1
```

**参数：**
- `stationId` - 站点ID（可选）
- `period` - 月份（可选，格式 YYYY-MM）
- `brandId` - 品牌方ID（可选）

**响应：**
```json
{
  "items": [
    {
      "record": {
        "id": 1,
        "stationId": 1,
        "period": "2026-07",
        "payStartDate": "2026-07-01",
        "payEndDate": "2026-07-31",
        "payKwh": 2500.00,
        "payUnitPrice": 0.65,
        "payAmount": 1625.00,
        "payStatus": "未付款",
        "collectStartDate": "2026-07-01",
        "collectEndDate": "2026-07-31",
        "collectKwh": 2500.00,
        "collectUnitPrice": 1.20,
        "collectAmount": 3000.00,
        "taxRate": 0.01,
        "collectNet": 2970.30,
        "collectStatus": "未到账",
        "profit": 1345.30,
        "opExpense": 500.00,
        "profitAfterOp": 845.30,
        "remark": null
      },
      "stationName": "五华站A",
      "landlordName": "五华区物业管理有限公司",
      "meterDetails": [
        {
          "meterId": 1,
          "meterNo": "M-001-01",
          "brandName": "美团",
          "startReading": 10000.00,
          "endReading": 12500.00,
          "kwh": 2500.00,
          "payUnitPrice": 0.65,
          "payAmount": 1625.00,
          "collectUnitPrice": 1.20,
          "collectAmount": 3000.00
        }
      ]
    }
  ]
}
```

### 获取电费详情
```
GET /api/trpc/ledger.electricityDetail?id=1
```

**响应：**
```json
{
  "record": {
    "id": 1,
    "stationId": 1,
    "stationName": "五华站A",
    "period": "2026-07",
    "payStartDate": "2026-07-01",
    "payEndDate": "2026-07-31",
    "payKwh": 2500.00,
    "payUnitPrice": 0.65,
    "payAmount": 1625.00,
    "payStatus": "未付款",
    "collectStartDate": "2026-07-01",
    "collectEndDate": "2026-07-31",
    "collectKwh": 2500.00,
    "collectUnitPrice": 1.20,
    "collectAmount": 3000.00,
    "taxRate": 0.01,
    "collectNet": 2970.30,
    "collectStatus": "未到账",
    "profit": 1345.30,
    "opExpense": 500.00,
    "profitAfterOp": 845.30,
    "remark": null
  },
  "meterDetails": [
    {
      "meterId": 1,
      "meterNo": "M-001-01",
      "brandName": "美团",
      "startDate": "2026-07-01",
      "endDate": "2026-07-31",
      "startReading": 10000.00,
      "endReading": 12500.00,
      "kwh": 2500.00,
      "payUnitPrice": 0.65,
      "payAmount": 1625.00,
      "collectUnitPrice": 1.20,
      "collectAmount": 3000.00,
      "taxRate": 0.01,
      "collectNet": 2970.30
    }
  ],
  "landlord": {
    "name": "五华区物业管理有限公司",
    "contact": "赵主任",
    "phone": "13800001111"
  }
}
```

### 创建电费记录
```
POST /api/trpc/mut.createElectricity
```

**请求：**
```json
{
  "stationId": 1,
  "period": "2026-07",
  "meterDetails": [
    {
      "meterId": 1,
      "startDate": "2026-07-01",
      "endDate": "2026-07-31",
      "startReading": 10000.00,
      "endReading": 12500.00,
      "payUnitPrice": 0.65,
      "collectUnitPrice": 1.20,
      "taxRate": 0.01
    }
  ],
  "opExpense": 500.00,
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 更新电费记录
```
POST /api/trpc/mut.updateElectricity
```

**请求：**
```json
{
  "id": 1,
  "stationId": 1,
  "period": "2026-07",
  "meterDetails": [
    {
      "meterId": 1,
      "startDate": "2026-07-01",
      "endDate": "2026-07-31",
      "startReading": 10000.00,
      "endReading": 12500.00,
      "payUnitPrice": 0.65,
      "collectUnitPrice": 1.20,
      "taxRate": 0.01
    }
  ],
  "opExpense": 500.00,
  "payStatus": "已付款",
  "collectStatus": "已到账",
  "remark": null
}
```

### 删除电费记录
```
POST /api/trpc/mut.deleteElectricity
```

**请求：**
```json
{
  "id": 1
}
```

### 获取电费月份列表
```
GET /api/trpc/ledger.electricityPeriods
```

**响应：**
```json
{
  "periods": ["2026-07", "2026-06", "2026-05"]
}
```

---

## 7. 场地租金管理

### 7.1 场租付款合同（公司 → 业主）

#### 获取场租付款合同列表
```
GET /api/trpc/ledger.rentLeases?stationId=1
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "contractStart": "2025-01-01",
      "contractEnd": "2027-12-31",
      "annualRent": 12000.00,
      "payMethod": "季付",
      "payAmount": 3000.00,
      "deposit": 5000.00,
      "payDeadline": "2026-04-01",
      "payStatus": "已付款",
      "invoiceType": "对公",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

#### 保存场租付款合同
```
POST /api/trpc/mut.saveLease
```

**请求（新建）：**
```json
{
  "stationId": 1,
  "contractStart": "2025-01-01",
  "contractEnd": "2027-12-31",
  "annualRent": 12000.00,
  "payMethod": "季付",
  "payAmount": 3000.00,
  "deposit": 5000.00,
  "payDeadline": "2026-04-01",
  "payStatus": "未付款",
  "invoiceType": "对公",
  "remark": null
}
```

**请求（更新）：**
```json
{
  "id": 1,
  "stationId": 1,
  "contractStart": "2025-01-01",
  "contractEnd": "2027-12-31",
  "annualRent": 12000.00,
  "payMethod": "季付",
  "payAmount": 3000.00,
  "deposit": 5000.00,
  "payDeadline": "2026-04-01",
  "payStatus": "已付款",
  "invoiceType": "对公",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 删除场租付款合同
```
POST /api/trpc/mut.deleteLease
```

**请求：**
```json
{
  "id": 1
}
```

---

### 7.2 场租收款合同（品牌方 → 公司）

#### 获取场租收款合同列表
```
GET /api/trpc/ledger.rentIncomes?stationId=1&brandId=1
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "brandId": 1,
      "brandName": "美团",
      "contractStart": "2025-01-01",
      "contractEnd": "2027-12-31",
      "unitMonthlyRent": 500.00,
      "cabinetsCount": 4,
      "monthlyRent": 2000.00,
      "annualIncome": 24000.00,
      "taxRate": 0.01,
      "annualIncomeNet": 23762.38,
      "inputCost": 5000.00,
      "profit": 18762.38,
      "signStatus": "已签约已开票",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z",
      "receipts": [
        {
          "id": 1,
          "seq": 1,
          "periodStart": "2025-01-01",
          "periodEnd": "2025-06-30",
          "amount": 12000.00,
          "status": "已到账",
          "remark": null
        },
        {
          "id": 3,
          "seq": 3,
          "periodStart": "2026-01-01",
          "periodEnd": "2026-06-30",
          "amount": 12000.00,
          "status": "未到账",
          "remark": null
        }
      ]
    }
  ]
}
```

#### 保存场租收款合同
```
POST /api/trpc/mut.saveRentIncome
```

**请求（按柜计价）：**
```json
{
  "stationId": 1,
  "brandId": 1,
  "contractStart": "2025-01-01",
  "contractEnd": "2027-12-31",
  "unitMonthlyRent": 500.00,
  "cabinetsCount": 4,
  "monthlyRent": 2000.00,
  "annualIncome": 24000.00,
  "taxRate": 0.01,
  "inputCost": 5000.00,
  "signStatus": "已签约",
  "remark": null
}
```

**请求（固定金额）：**
```json
{
  "stationId": 1,
  "brandId": 2,
  "contractStart": "2025-06-01",
  "contractEnd": "2026-05-31",
  "unitMonthlyRent": null,
  "cabinetsCount": null,
  "monthlyRent": 1200.00,
  "annualIncome": 14400.00,
  "taxRate": 0.01,
  "inputCost": 3000.00,
  "signStatus": "已签约",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 删除场租收款合同
```
POST /api/trpc/mut.deleteRentIncome
```

**请求：**
```json
{
  "id": 1
}
```

---

### 7.3 租金分期收款

#### 保存租金分期收款
```
POST /api/trpc/mut.saveReceipt
```

**请求（新建）：**
```json
{
  "rentIncomeId": 1,
  "seq": 1,
  "periodStart": "2025-01-01",
  "periodEnd": "2025-06-30",
  "amount": 12000.00,
  "status": "未到账",
  "remark": null
}
```

**请求（更新状态）：**
```json
{
  "id": 1,
  "rentIncomeId": 1,
  "seq": 1,
  "periodStart": "2025-01-01",
  "periodEnd": "2025-06-30",
  "amount": 12000.00,
  "status": "已到账",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

#### 删除租金分期收款
```
POST /api/trpc/mut.deleteReceipt
```

**请求：**
```json
{
  "id": 1
}
```

---

## 8. 分红计算与管理

### 计算分红（预览，不入库）
```
POST /api/trpc/dividend.calculate
```

**请求：**
```json
{
  "stationId": 1,
  "period": "2026-07"
}
```

**响应：**
```json
{
  "stationId": 1,
  "stationName": "五华站A",
  "period": "2026-07",
  "companyShare": 0.6,
  "income": {
    "elecIncome": {
      "total": 3000.00,
      "details": [
        {
          "meterId": 1,
          "meterNo": "M-001-01",
          "brandName": "美团",
          "startDate": "2026-07-01",
          "endDate": "2026-07-31",
          "kwh": 2500.00,
          "unitPrice": 1.20,
          "amount": 3000.00
        }
      ]
    },
    "rentIncome": {
      "total": 2000.00,
      "details": [
        {
          "brandName": "美团",
          "cabinets": 4,
          "unitMonthlyRent": 500.00,
          "amount": 2000.00
        }
      ]
    },
    "totalIncome": 5000.00
  },
  "cost": {
    "elecCost": {
      "total": 1625.00,
      "details": [
        {
          "meterId": 1,
          "meterNo": "M-001-01",
          "kwh": 2500.00,
          "unitPrice": 0.65,
          "amount": 1625.00
        }
      ]
    },
    "rentCost": {
      "total": 1000.00,
      "details": [
        {
          "landlordName": "五华区物业管理有限公司",
          "annualRent": 12000.00,
          "monthlyRent": 1000.00
        }
      ]
    },
    "opExpense": {
      "total": 500.00,
      "remark": "维护费200 + 保险300"
    },
    "bizDividendCost": {
      "total": 187.50,
      "details": [
        {
          "introducerName": "张介绍",
          "mode": "利润分红",
          "ratio": 0.1,
          "amount": 187.50,
          "countAsCost": true
        }
      ]
    },
    "totalCost": 3312.50
  },
  "profit": 1687.50,
  "dividends": {
    "business": [
      {
        "introducerId": 1,
        "introducerName": "张介绍",
        "mode": "利润分红",
        "ratio": 0.1,
        "countAsCost": true,
        "baseAmount": 1875.00,
        "amount": 187.50
      }
    ],
    "shareholder": [
      {
        "shareholderId": 1,
        "shareholderName": "陈总",
        "mode": "利润分红",
        "ratio": 0.3,
        "baseAmount": 1687.50,
        "amount": 506.25
      },
      {
        "shareholderId": 2,
        "shareholderName": "刘总",
        "mode": "收入分红",
        "ratio": 0.1,
        "baseAmount": 5000.00,
        "amount": 500.00
      },
      {
        "shareholderId": 3,
        "shareholderName": "周总",
        "mode": "固定金额",
        "fixedAmount": 500.00,
        "baseAmount": null,
        "amount": 500.00
      }
    ]
  },
  "summary": {
    "totalBusinessDividend": 187.50,
    "totalShareholderDividend": 1506.25,
    "totalDividend": 1693.75,
    "companyNetProfit": -106.25
  }
}
```

### 创建分红记录
```
POST /api/trpc/dividend.create
```

**请求：**
```json
{
  "stationId": 1,
  "period": "2026-07",
  "type": "股东分红",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 获取分红列表
```
GET /api/trpc/dividend.list?stationId=1&period=2026-07&type=股东分红&status=未结算
```

**参数：**
- `stationId` - 站点ID（可选）
- `period` - 期间（可选）
- `type` - 类型：商务分红/股东分红（可选）
- `status` - 状态（可选）

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "period": "2026-07",
      "type": "股东分红",
      "totalIncome": 5000.00,
      "totalCost": 3312.50,
      "profit": 1687.50,
      "status": "未结算",
      "settlementDate": "2026-07-31",
      "createdAt": "2026-07-30T10:00:00Z",
      "shares": [
        {
          "id": 1,
          "shareholderId": 1,
          "shareholderName": "陈总",
          "mode": "利润分红",
          "ratio": 0.3,
          "amount": 506.25
        },
        {
          "id": 2,
          "shareholderId": 2,
          "shareholderName": "刘总",
          "mode": "收入分红",
          "ratio": 0.1,
          "amount": 500.00
        }
      ]
    }
  ]
}
```

### 获取分红详情（含完整数据来源）
```
GET /api/trpc/dividend.detail?id=1
```

**响应：**
```json
{
  "id": 1,
  "stationId": 1,
  "stationName": "五华站A",
  "period": "2026-07",
  "type": "股东分红",
  "status": "未结算",
  "settlementDate": "2026-07-31",
  "companyShare": 0.6,
  "income": {
    "elecIncome": 3000.00,
    "rentIncome": 2000.00,
    "totalIncome": 5000.00
  },
  "cost": {
    "elecCost": 1625.00,
    "rentCost": 1000.00,
    "opExpense": 500.00,
    "bizDividendCost": 187.50,
    "totalCost": 3312.50
  },
  "profit": 1687.50,
  "shares": [
    {
      "id": 1,
      "shareholderId": 1,
      "shareholderName": "陈总",
      "mode": "利润分红",
      "ratio": 0.3,
      "amount": 506.25
    },
    {
      "id": 2,
      "shareholderId": 2,
      "shareholderName": "刘总",
      "mode": "收入分红",
      "ratio": 0.1,
      "amount": 500.00
    }
  ],
  "dataSources": {
    "electricity": [
      {
        "meterId": 1,
        "meterNo": "M-001-01",
        "brandName": "美团",
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "startReading": 10000.00,
        "endReading": 12500.00,
        "kwh": 2500.00,
        "payUnitPrice": 0.65,
        "payAmount": 1625.00,
        "collectUnitPrice": 1.20,
        "collectAmount": 3000.00,
        "taxRate": 0.01,
        "collectNet": 2970.30
      }
    ],
    "rent": {
      "lease": {
        "landlordName": "五华区物业管理有限公司",
        "annualRent": 12000.00,
        "payMethod": "季付",
        "payAmount": 3000.00,
        "monthlyRent": 1000.00
      },
      "incomes": [
        {
          "brandName": "美团",
          "cabinets": 4,
          "unitMonthlyRent": 500.00,
          "monthlyRent": 2000.00
        }
      ]
    },
    "operatingExpense": {
      "amount": 500.00,
      "remark": "维护费200 + 保险300"
    },
    "businessDividends": [
      {
        "introducerName": "张介绍",
        "mode": "利润分红",
        "ratio": 0.1,
        "countAsCost": true,
        "amount": 187.50
      }
    ]
  },
  "remark": null,
  "createdAt": "2026-07-30T10:00:00Z"
}
```

### 按股东汇总分红
```
GET /api/trpc/dividend.summary?shareholderId=1&period=2026-07
```

**参数：**
- `shareholderId` - 股东ID（可选）
- `period` - 期间（可选）

**响应：**
```json
{
  "shareholderId": 1,
  "shareholderName": "陈总",
  "period": "2026-07",
  "totalAmount": 2506.25,
  "settledAmount": 0,
  "pendingAmount": 2506.25,
  "details": [
    {
      "dividendId": 1,
      "stationId": 1,
      "stationName": "五华站A",
      "type": "股东分红",
      "mode": "利润分红",
      "ratio": 0.3,
      "profit": 1687.50,
      "amount": 506.25,
      "status": "未结算",
      "settlementDate": "2026-07-31"
    },
    {
      "dividendId": 2,
      "stationId": 2,
      "stationName": "盘龙站B",
      "type": "股东分红",
      "mode": "收入分红",
      "ratio": 0.2,
      "totalIncome": 6500.00,
      "amount": 1300.00,
      "status": "未结算",
      "settlementDate": "2026-07-31"
    },
    {
      "dividendId": 3,
      "stationId": 3,
      "stationName": "官渡站C",
      "type": "股东分红",
      "mode": "固定金额",
      "fixedAmount": 700.00,
      "amount": 700.00,
      "status": "未结算",
      "settlementDate": "2026-09-30"
    }
  ]
}
```

### 按介绍人汇总商务分红
```
GET /api/trpc/dividend.introducerSummary?introducerId=1&period=2026-07
```

**响应：**
```json
{
  "introducerId": 1,
  "introducerName": "张介绍",
  "period": "2026-07",
  "totalAmount": 487.50,
  "settledAmount": 0,
  "pendingAmount": 487.50,
  "details": [
    {
      "dividendId": 10,
      "stationId": 1,
      "stationName": "五华站A",
      "mode": "利润分红",
      "ratio": 0.1,
      "countAsCost": true,
      "profit": 1875.00,
      "amount": 187.50,
      "status": "未结算"
    },
    {
      "dividendId": 11,
      "stationId": 2,
      "stationName": "盘龙站B",
      "mode": "固定金额",
      "fixedAmount": 300.00,
      "countAsCost": false,
      "amount": 300.00,
      "status": "未结算"
    }
  ]
}
```

### 提交分红审批
```
POST /api/trpc/dividend.submit
```

**请求：**
```json
{
  "dividendId": 1,
  "applicant": "张三",
  "targetApprover": "陈总",
  "reason": "五华站A 2026年7月股东分红",
  "remark": null
}
```

**响应：**
```json
{
  "ok": true,
  "approvalRequestId": 10
}
```

### 审批通过
```
POST /api/trpc/dividend.approve
```

**请求：**
```json
{
  "dividendId": 1,
  "approver": "陈总",
  "comment": "同意"
}
```

### 审批驳回
```
POST /api/trpc/dividend.reject
```

**请求：**
```json
{
  "dividendId": 1,
  "approver": "陈总",
  "comment": "金额有误，请重新核算"
}
```

### 标记已结算
```
POST /api/trpc/dividend.settle
```

**请求：**
```json
{
  "dividendId": 1,
  "remark": "已转账"
}
```

---

## 9. 看板与汇总

### 经营总览
```
GET /api/trpc/dashboard.overview
```

**响应：**
```json
{
  "stationCount": 4,
  "activeStations": 3,
  "meterCount": 8,
  "introducerCount": 2,
  "shareholderCount": 3,
  "elecProfit": 5000.00,
  "elecPay": 8000.00,
  "elecCollect": 13000.00,
  "elecUnpaid": 2000.00,
  "elecUncollected": 3000.00,
  "rentIncomeTotal": 52800.00,
  "rentCostTotal": 39600.00,
  "rentProfit": 13200.00,
  "rentUncollected": 12000.00,
  "opExpenseTotal": 1500.00,
  "bizDividendTotal": 1500.00,
  "shareholderDividendTotal": 8500.00,
  "totalProfit": 18200.00,
  "contractCount": 3,
  "expiringContracts": 1,
  "expiredContracts": 0,
  "pendingDividends": 5,
  "pendingApprovals": 2,
  "monthly": [
    {
      "period": "2026-05",
      "elecPay": 3530.00,
      "elecCollect": 6490.00,
      "elecProfit": 2960.00,
      "rentProfit": 2200.00,
      "totalProfit": 5160.00
    },
    {
      "period": "2026-06",
      "elecPay": 4745.00,
      "elecCollect": 8740.00,
      "elecProfit": 3995.00,
      "rentProfit": 2200.00,
      "totalProfit": 6195.00
    }
  ]
}
```

### 站点看板
```
GET /api/trpc/dashboard.stationBoard?brandId=1&entityId=1&landlordId=1&keyword=五华
```

**响应：**
```json
{
  "items": [
    {
      "station": {
        "id": 1,
        "name": "五华站A",
        "code": "WH-001",
        "region": "五华区",
        "status": "运营中"
      },
      "landlordName": "五华区物业管理有限公司",
      "meterCount": 2,
      "brandNames": ["美团", "哈啰"],
      "elecPay": 1625.00,
      "elecCollect": 3000.00,
      "elecProfit": 1345.30,
      "rentCost": 1000.00,
      "rentIncome": 2000.00,
      "rentProfit": 1000.00,
      "opExpense": 500.00,
      "bizDividend": 187.50,
      "shareholderDividend": 1506.25,
      "totalProfit": 1845.30,
      "companyNetProfit": -160.95,
      "periods": ["2026-07", "2026-06"]
    }
  ]
}
```

### 品牌方看板
```
GET /api/trpc/dashboard.brandBoard
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "美团",
      "contact": "张经理",
      "stationCount": 2,
      "meterCount": 4,
      "elecPay": 3000.00,
      "elecCollect": 5500.00,
      "elecProfit": 2500.00,
      "rentIncome": 4000.00,
      "rentProfit": 3000.00,
      "totalProfit": 5500.00
    }
  ]
}
```

### 公司主体看板
```
GET /api/trpc/dashboard.entityBoard
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "云南来换电新能源有限公司",
      "shortName": "来换电",
      "stationCount": 2,
      "elecPay": 4000.00,
      "elecCollect": 7000.00,
      "elecProfit": 3000.00,
      "rentCost": 3000.00,
      "rentIncome": 5000.00,
      "rentProfit": 2000.00,
      "totalProfit": 5000.00
    }
  ]
}
```

### 场地方看板
```
GET /api/trpc/dashboard.landlordBoard
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "五华区物业管理有限公司",
      "contact": "赵主任",
      "stationCount": 1,
      "elecPay": 1625.00,
      "rentCost": 1000.00,
      "totalCost": 2625.00
    }
  ]
}
```

### 股东看板
```
GET /api/trpc/dashboard.shareholderBoard
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "name": "陈总",
      "phone": "13900001111",
      "stations": [
        {
          "stationId": 1,
          "stationName": "五华站A",
          "mode": "利润分红",
          "ratio": 0.3
        },
        {
          "stationId": 2,
          "stationName": "盘龙站B",
          "mode": "收入分红",
          "ratio": 0.2
        }
      ],
      "totalAmount": 2506.25,
      "settledAmount": 0,
      "pendingAmount": 2506.25,
      "dividends": [
        {
          "period": "2026-07",
          "stationName": "五华站A",
          "mode": "利润分红",
          "ratio": 0.3,
          "amount": 506.25,
          "status": "未结算"
        }
      ]
    }
  ]
}
```

### 电量汇总
```
GET /api/trpc/dashboard.kwhSummary
```

**响应：**
```json
{
  "month": {
    "label": "2026-07",
    "kwh": 6200.00
  },
  "quarter": {
    "label": "2026 Q3",
    "kwh": 18500.00
  },
  "year": {
    "label": "2026年",
    "kwh": 85000.00
  },
  "byBrand": [
    {
      "brandName": "美团",
      "monthKwh": 3500.00,
      "quarterKwh": 10500.00,
      "yearKwh": 50000.00
    },
    {
      "brandName": "哈啰",
      "monthKwh": 2700.00,
      "quarterKwh": 8000.00,
      "yearKwh": 35000.00
    }
  ],
  "monthly": [
    { "period": "2026-01", "kwh": 12000.00 },
    { "period": "2026-02", "kwh": 11500.00 },
    { "period": "2026-03", "kwh": 13000.00 },
    { "period": "2026-04", "kwh": 14000.00 },
    { "period": "2026-05", "kwh": 15000.00 },
    { "period": "2026-06", "kwh": 16000.00 },
    { "period": "2026-07", "kwh": 6200.00 }
  ]
}
```

---

## 10. 审批管理

### 获取审批流程配置
```
GET /api/trpc/approval.flows
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "bizType": "股东分红",
      "nodes": [
        { "name": "经办人", "approver": "经办人", "timeoutHours": null },
        { "name": "部门负责人", "approver": "部门负责人", "timeoutHours": 24 },
        { "name": "总经理审批", "approver": "陈总", "timeoutHours": 48 },
        { "name": "财务审核付款", "approver": "财务负责人", "timeoutHours": 24 }
      ],
      "updatedAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

### 保存审批流程配置
```
POST /api/trpc/approval.saveFlow
```

**请求：**
```json
{
  "bizType": "股东分红",
  "nodes": [
    { "name": "经办人", "approver": "经办人", "timeoutHours": null },
    { "name": "部门负责人", "approver": "部门负责人", "timeoutHours": 24 },
    { "name": "总经理审批", "approver": "陈总", "timeoutHours": 48 },
    { "name": "财务审核付款", "approver": "财务负责人", "timeoutHours": 24 }
  ]
}
```

### 创建审批单
```
POST /api/trpc/approval.create
```

**请求：**
```json
{
  "bizType": "股东分红",
  "title": "五华站A 2026年7月股东分红",
  "reason": "本月净利润1687.50元，按比例分红",
  "amount": 1687.50,
  "applicant": "张三",
  "targetApprover": "陈总",
  "attachments": []
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 获取审批列表
```
GET /api/trpc/approval.list?bizType=股东分红&status=审批中&applicant=张三&dateFrom=2026-07-01&dateTo=2026-07-31
```

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "bizType": "股东分红",
      "title": "五华站A 2026年7月股东分红",
      "reason": "本月净利润1687.50元，按比例分红",
      "amount": 1687.50,
      "applicant": "张三",
      "currentNode": 2,
      "currentNodeName": "总经理审批",
      "status": "审批中",
      "createdAt": "2026-07-30T10:00:00Z",
      "finishedAt": null,
      "flowNodes": [
        { "name": "经办人", "approver": "经办人" },
        { "name": "部门负责人", "approver": "部门负责人" },
        { "name": "总经理审批", "approver": "陈总" },
        { "name": "财务审核付款", "approver": "财务负责人" }
      ]
    }
  ]
}
```

### 获取审批详情
```
GET /api/trpc/approval.detail?id=1
```

**响应：**
```json
{
  "id": 1,
  "bizType": "股东分红",
  "title": "五华站A 2026年7月股东分红",
  "reason": "本月净利润1687.50元，按比例分红",
  "amount": 1687.50,
  "applicant": "张三",
  "attachments": [],
  "flowNodes": [
    { "name": "经办人", "approver": "经办人" },
    { "name": "部门负责人", "approver": "部门负责人" },
    { "name": "总经理审批", "approver": "陈总" },
    { "name": "财务审核付款", "approver": "财务负责人" }
  ],
  "currentNode": 2,
  "status": "审批中",
  "urgeCount": 0,
  "createdAt": "2026-07-30T10:00:00Z",
  "finishedAt": null,
  "records": [
    {
      "id": 1,
      "nodeIndex": 0,
      "nodeName": "经办人",
      "approver": "张三",
      "action": "提交",
      "comment": "五华站A 2026年7月股东分红",
      "createdAt": "2026-07-30T10:00:00Z"
    },
    {
      "id": 2,
      "nodeIndex": 1,
      "nodeName": "部门负责人",
      "approver": "部门负责人",
      "action": "通过",
      "comment": "同意",
      "createdAt": "2026-07-31T09:00:00Z"
    }
  ]
}
```

### 审批操作
```
POST /api/trpc/approval.act
```

**请求（通过）：**
```json
{
  "requestId": 1,
  "action": "通过",
  "approver": "陈总",
  "comment": "同意"
}
```

**请求（驳回）：**
```json
{
  "requestId": 1,
  "action": "驳回",
  "approver": "陈总",
  "comment": "金额有误，请重新核算"
}
```

**请求（转办）：**
```json
{
  "requestId": 1,
  "action": "转办",
  "approver": "陈总",
  "comment": "转给副总处理",
  "targetApprover": "副总"
}
```

**请求（加签）：**
```json
{
  "requestId": 1,
  "action": "加签",
  "approver": "陈总",
  "comment": "需要财务确认",
  "extraNode": {
    "name": "财务确认",
    "approver": "财务负责人"
  }
}
```

**请求（催办）：**
```json
{
  "requestId": 1,
  "action": "催办",
  "approver": "张三",
  "comment": "请尽快处理"
}
```

**响应：**
```json
{
  "ok": true
}
```

### 审批统计
```
GET /api/trpc/approval.stats
```

**响应：**
```json
{
  "total": 10,
  "pending": 3,
  "approved": 5,
  "rejected": 2,
  "byBizType": [
    { "bizType": "股东分红", "count": 4, "pending": 1 },
    { "bizType": "电费付款", "count": 3, "pending": 1 },
    { "bizType": "租金付款", "count": 2, "pending": 1 },
    { "bizType": "费用报销", "count": 1, "pending": 0 }
  ]
}
```

---

## 11. 合同管理

### 获取合同列表
```
GET /api/trpc/ledger.contracts?brandId=1&keyword=五华
```

**参数：**
- `brandId` - 品牌方ID（可选）
- `keyword` - 关键词搜索（可选）

**响应：**
```json
{
  "items": [
    {
      "id": 1,
      "brandId": 1,
      "brandName": "美团",
      "stationId": 1,
      "stationName": "五华站A",
      "address": "五华区人民路100号",
      "payEntity": "云南来换电新能源有限公司",
      "partner": "美团",
      "contractType": "合作",
      "startDate": "2025-01-01",
      "endDate": "2027-12-31",
      "daysLeft": 519,
      "status": "正常",
      "remark": null,
      "createdAt": "2026-07-30T10:00:00Z"
    }
  ]
}
```

### 保存合同
```
POST /api/trpc/mut.saveContract
```

**请求（新建）：**
```json
{
  "brandId": 1,
  "stationId": 1,
  "stationName": "五华站A",
  "address": "五华区人民路100号",
  "payEntity": "云南来换电新能源有限公司",
  "partner": "美团",
  "contractType": "合作",
  "startDate": "2025-01-01",
  "endDate": "2027-12-31",
  "remark": null
}
```

**请求（更新）：**
```json
{
  "id": 1,
  "brandId": 1,
  "stationId": 1,
  "stationName": "五华站A",
  "address": "五华区人民路100号",
  "payEntity": "云南来换电新能源有限公司",
  "partner": "美团",
  "contractType": "合作",
  "startDate": "2025-01-01",
  "endDate": "2027-12-31",
  "remark": "已续签"
}
```

**响应：**
```json
{
  "ok": true,
  "id": 1
}
```

### 删除合同
```
POST /api/trpc/mut.deleteContract
```

**请求：**
```json
{
  "id": 1
}
```

---

## 附录：枚举值说明

### 站点状态
- `运营中`
- `筹建中`
- `已关停`

### 电表状态
- `正常`
- `停用`

### 分红模式
- `收入分红` - 分红基数 = 电费收款 + 租金收款
- `利润分红` - 分红基数 = 净利润（总收入 - 总成本）
- `固定金额` - 直接填写固定金额

### 结算周期
- `月` - 每月结算
- `季` - 每季度结算
- `年` - 每年结算

### 分红类型
- `商务分红` - 给介绍人的分红
- `股东分红` - 给股东的分红

### 分红状态
- `未结算` - 系统已计算，未提交审批
- `申报中` - 已提交审批，等待处理
- `已通过` - 审批通过，可打款
- `已驳回` - 审批驳回，需修改
- `已结算` - 已完成打款

### 电费付款状态
- `未付款`
- `已付款`

### 电费收款状态
- `未到账`
- `已到账`

### 租金收款状态
- `未到账`
- `已到账`

### 合同类型
- `场租付款`
- `场租收款`
- `电费`
- `合作`
- `其他`

### 合同状态（自动计算）
- `正常` - 距离到期 > 90天
- `临期` - 距离到期 ≤ 90天
- `已到期` - 已过期
- `未知` - 无结束日期

### 审批操作
- `提交`
- `通过`
- `驳回`
- `转办`
- `加签`
- `催办`

### 审批状态
- `审批中`
- `已通过`
- `已驳回`

---

## 附录：计算公式

### 电费利润
```
电费利润 = 电费收款（不含税） - 电费付款
```

### 租金利润
```
租金利润 = 租金收款（不含税） - 场地租金成本
```

### 商务分红（计入成本时）
```
商务分红基数 = 总收入 - 电费成本 - 场地租金 - 运营费用
商务分红金额 = 商务分红基数 × 比例（或固定金额）
总成本 = 电费成本 + 场地租金 + 运营费用 + 商务分红金额
```

### 商务分红（不计入成本时）
```
总成本 = 电费成本 + 场地租金 + 运营费用
净利润 = 总收入 - 总成本
商务分红金额 = 净利润 × 比例（或固定金额）
```

### 股东分红
```
按利润分红：分红金额 = 净利润 × 占股比例
按收入分红：分红金额 = 总收入 × 占股比例
固定金额：分红金额 = 固定金额
```
