# 换电站经营管理平台 - 逐页数据清单（进行中）

> 目的：分两步梳理 ——
> **第一步**：一个页面一个页面地梳理「该页面调用了哪些接口、接口返回了哪些字段、这些字段具体是什么」；
> **第二步**：再梳理「哪个数据被哪个页面引用、做了哪些计算、又产出了哪些数据」。
>
> 依据代码 + 运行库（Postgres `huandian_v2`）核验，只读分析，未动代码。
>
> **进度**：✅ Meters（电表）已完成 ｜ ✅ Contracts（合同）已完成 ｜ ✅ Shareholders（股东分红）已完成

---

## 第一步 · 逐页「调用了哪些接口，返回了什么」

---

### Meters（电表）页 — 已完成

页面文件：`src/pages/Meters.tsx` ｜ API 层：`src/api/meters.ts` `src/api/cabinets.ts` `src/api/meterEnergy.ts`

> 页面包含 4 个子部件：主列表、电表表单(MeterForm)、录入读数(ReadingForm)、柜子表单(CabinetForm)。按「进入页面 → 展开电表 → 打开表单」三层拆解。

#### ⓪ 先分清两条数据路径：本地查询 vs 第三方同步

```
路 A（查询）：GET /api/meters 等 —— 只查本地 PostgreSQL
     本地库(meters/meter_monthly/...) ──SELECT──► 页面展示
     全程不碰第三方平台

路 B（同步）：POST /api/meter-energy/sync?type=… —— 才去第三方平台
     天雀电表 API (https://api1.tqdianbiao.com) ──拉取──► 写入本地库(meter_* 表)
     这是页面右上角「刷新电表数据」按钮，每日限 10 次
```

**第三方数据是怎么进到本地库的**（sync 七步逐一对应写入的表）：

| 同步步骤 | 调用函数 | 调第三方接口 | 写入本地表 | 冲突键 |
|---|---|---|---|---|
| devices | `sync_devices` | get_devices | `meter_devices` | `address` |
| collectors | `sync_collectors` | get_collectors | `meter_collectors` | `id` |
| status | `sync_status` | get_status | `meter_status_cache` | 每行插入（含 c0~c4 分时度数、remain_money 余额） |
| hourly | `sync_hourly_data` | get_electricity_by_hour(近24h) | `meter_hourly` | `(device_id, hour_time)` |
| daily | `sync_daily_data` | get_electricity_by_day(近31天) | `meter_daily` | `(device_id, day_date)` |
| monthly | `sync_monthly_data` | get_electricity_by_month(近12月) | `meter_monthly` | `(address, month_period)` |
| warnings | `sync_warnings` | get_warnings | `meter_warnings_cache` | 先 DELETE 全表再插入 |

> 🔑 关键机制：
> - `meter_monthly`（页面读数的直接来源）有**两条写入通道**：sync 自动同步、手动录读数（`POST /api/meter-energy/readings`）。两者都 upsert 到同一张表。
> - 同步是「**一次性搬回本地**」：sync 之后，页面所有查询都只读本地表，不再实时访问第三方。
> - sync 的 device_id→address 映射依赖 `meter_devices`（先同步 devices，后面的能耗同步才能补 address）。
> - 每次同步都会写 `sync_logs`（可 GET `/api/meter-energy/sync-logs` 查历史）。

#### ⓪·1 点击「刷新电表数据」按钮，具体发生什么

前端 `doSync()` 依次调用 **同一个接口 7 次**，靠 `type` 参数区分（`src/pages/Meters.tsx:183-211`）：

```
点「刷新电表数据」
  POST /api/meter-energy/sync?type=devices
  POST /api/meter-energy/sync?type=collectors
  POST /api/meter-energy/sync?type=status
  POST /api/meter-energy/sync?type=hourly
  POST /api/meter-energy/sync?type=daily
  POST /api/meter-energy/sync?type=monthly
  POST /api/meter-energy/sync?type=warnings
  └ 全部完成后 invalidate ["meters"] → 重新 GET /api/meters 刷新页面列表
```

每次调用后端 `trigger_sync(type)` → 调天雀 API → 写本地表 → 记 `sync_logs`：

| 步骤 | type | 后端调第三方 | 第三方端点 | 拿回什么 | 写入本地表 | 冲突键 |
|---|---|---|---|---|---|---|
| 1 | devices | `get_devices()` | GET `/Api/Meter` | 电表列表（id/address/collectorid/description/rate） | `meter_devices` | address |
| 2 | collectors | `get_collectors()` | GET `/Api/Collector` | 采集器列表（id/collectorid/description/count） | `meter_collectors` | id |
| 3 | status | `get_status()` | GET `/Api/EleMeterState` | 实时状态（c0~c4 分时电量、remain_money 余额） | `meter_status_cache` | 逐行插入 |
| 4 | hourly | `get_electricity_by_hour()` | GET `/Api/StatisticEle/hour` | 近 24 小时每小时电量（d/s/e 数组） | `meter_hourly` | (device_id, hour_time) |
| 5 | daily | `get_electricity_by_day()` | GET `/Api/StatisticEle/day` | 近 31 天每日电量 | `meter_daily` | (device_id, day_date) |
| 6 | monthly | `get_electricity_by_month()` | GET `/Api/StatisticEle/month` | 近 12 月每月电量 + 起止度数 | `meter_monthly` | (address, month_period) |
| 7 | warnings | `get_warnings()` | GET `/Api/Warning` | 报警信息（device_type/address/warning_def_id/msg） | `meter_warnings_cache` | 先 DELETE 全表 |

关键说明：

1. **第三方统一返回** `{"status":1, "total":64, "data":[...]}`，后端 `_extract_data()` 抽 `data`。能耗类每项含 `d`(分时度数数组)、`s`(起始度数)、`e`(抄表度数)，由 `parse_kwh_data()` 解析。
2. **monthly 步最重要**：拿回的月度数据带 `prev_reading`/`curr_reading`（起止度数）→ 存进 `meter_monthly`。这是「录读数」弹窗和「电费生成 generate」的数据基础。
3. **7 步有先后依赖**：第 4-6 步要 `device_id→address` 映射，靠第 1 步写 `meter_devices` 才能补电表号，顺序不能乱。
4. **刷新后页面列表只刷新电表档案**：invalidate 的是 `["meters"]`（重新 GET /api/meters，读 meters 表）。能耗数据入库后要展示，还得再走 `GET /api/meter-energy/monthly` 等查询接口。
5. 每个第三方请求都带 `auth` 鉴权参数（`TQ_AUTH_CODE`）。
6. 每日限 10 次，由前端 localStorage 记次（24h 重置）。

#### ⓪·2 第三方接口的「真实返回示例」（来自运行库 raw_data 原始字段）

> 第三方返回的数据在 sync 时被**逐字原样**存入本地各表的 `raw_data`(JSONB) 字段。以下均为当前运行库中的真实数据，可直接还原第三方接口返回内容。

**devices → `/Api/Meter`**（存入 `meter_devices`，取 d.id/d.collectorid/d.address/d.description/d.rate）：
```json
{ "id": "3727847", "collectorid": "260319550055", "address": "260319550055",
  "description": "台铃-官南大道站", "rate": "40.00" }
```
> 实际第三方还有更多字段，后端只挑这 5 个入库。

**collectors → `/Api/Collector`**（存入 `meter_collectors.raw_data`，整段 JSON 原样保存）：
```json
{ "id": "1461708", "csq": "29", "imei": "862873084074373", "iccid": "89860625810083792224",
  "online": true, "collectorid": "260319550055", "description": "台铃-官南大道站",
  "connect_time": "2026-08-07 12:03:35" }
```

**status → `/Api/EleMeterState`**（存入 `meter_status_cache` 的 c0~c4、remain_money）：
```json
{ "device_id": "3727847", "address": "260319550055", "c0": 266.55, "c1": 0.00, "c2": 0.00,
  "c3": 0.00, "c4": 0.00, "remain_money": 0.00, "synced_at": "2026-08-07 05:29:14" }
```
> c0=总电量，c1~c4=尖/峰/平/谷分时电量。

**hourly → `/Api/StatisticEle/hour`**（存入 `meter_hourly.raw_data`，原样 JSON）：
```json
{ "d": [16.4], "e": [7598.0], "r": 40, "s": [7581.6],
  "et": "2026/8/7 5:58:56", "st": "2026/8/7 4:59:43", "mid": 3754022 }
```
> d=该时段电量，s=起始度数，e=抄表度数，r=倍率，st/et=起止时间，mid=设备ID。多费率时 d/s/e 是数组（尖峰平谷）。

**daily → `/Api/StatisticEle/day`**（存入 `meter_daily.raw_data`）：
```json
{ "d": [180.5], "e": [10419.0], "r": 50, "s": [10238.5],
  "et": "2026/8/7 13:27:39", "st": "2026/8/6 23:59:10", "mid": 3737260 }
```

**monthly → `/Api/StatisticEle/month`**（存入 `meter_monthly.raw_data`，**同时解析出 prev_reading/curr_reading 起止度数列**）：
```json
{ "d": [1946.5], "e": [6767.5], "r": 50, "s": [4821.0],
  "et": "2026/8/7 0:01:05", "st": "2026/8/1 0:01:04", "mid": 3845191 }
```
> 解析结果：kwh=1946.5，prev_reading(s)=4821.0，curr_reading(e)=6767.5，prev_date=2026-08-01，curr_date=2026-08-07。

**warnings → `/Api/Warning`**（存入 `meter_warnings_cache`，先 DELETE 全表再插）：
```json
{ "device_type": 0, "device_id": "3777806", "device_address": "260319554802",
  "warning_def_id": 1004, "start_time": "2026-07-27 22:12:50", "msg": "" }
```

---

#### ① 进入页面时（挂载即请求）

---

**1️⃣ GET `/api/meters`** ← `listMeters()`

- **作用**：电表主列表（全表返回，前端再筛）
- **请求参数**：无（可选 `stationId` / `brandId` / `landlordId`，本页不传）
- **返回字段**（`meters` 表 + 联表）：

| 字段 | 类型 | 来源 | 含义 |
|---|---|---|---|
| id | int | meters | 电表ID |
| station_id | int | meters | 所属站点ID |
| brand_id | int | meters | 品牌方ID |
| meter_no | varchar | meters | 电表编号（全局唯一，是 meter_monthly 的匹配键） |
| meter_name | varchar | meters | 电表名称 |
| collector_id | varchar | meters | 采集器号 |
| transformer_ratio | numeric(10,2) | meters | 互感器倍数（生成电费时 × 表码） |
| status | varchar | meters | 状态：正常/… |
| remark | text | meters | 备注 |
| landlord_id | int | meters | 场地方ID（**注：init.sql 没有此列，为后来 ALTER 加的**） |
| entity_id | int | meters | 报税公司主体ID（同上，后加的） |
| station_name | varchar | JOIN stations | 站点名称 |
| brand_name | varchar | JOIN brands | 品牌方名称 |
| landlord_name | varchar | JOIN landlords | 场地方名称 |
| entity_name | varchar | JOIN entities | 公司主体名称 |

- **真实数据样例**：

```json
[
  { "id": 2, "station_id": 2, "brand_id": 2, "meter_no": "260319550056",
    "meter_name": "台铃-螺狮湾站", "collector_id": "260319550056",
    "transformer_ratio": 40.00, "status": "正常", "remark": null,
    "landlord_id": 4, "entity_id": 1,
    "station_name": "台铃-螺狮湾站", "brand_name": "台铃",
    "landlord_name": "螺蛳湾", "entity_name": "财税1" },
  { "id": 3, "station_id": 3, "brand_id": 3, "meter_no": "260319554843",
    "meter_name": "八维通-871文创园站", "collector_id": "260319554843",
    "transformer_ratio": 40.00, "status": "正常", "remark": null,
    "landlord_id": null, "entity_id": null,
    "station_name": "八维通-871文创园站", "brand_name": "八维通",
    "landlord_name": null, "entity_name": null }
]
```

> ⚠️ 注意真实数据：电表 id=3 的 `landlord_id` 为 **NULL**，而其所属站点在 `stations` 表里 landlord_id 也是 NULL。这就是治理清单里 P2 的「双源 landlord」隐患现场。

---

**2️⃣ GET `/api/directory/landlords`** ← `listLandlords()`

- **作用**：场地方下拉框（「全部场地方」筛选 + 表单里选场地方）
- **返回字段**（`landlords` 全表）：`id` / `name` / `contact` / `phone` / `remark` / `created_at`
- **真实样例**：
```json
[ { "id": 4, "name": "螺蛳湾", "contact": "王", "phone": "132356565", "remark": null, "created_at": "..." } ]
```

---

**3️⃣ GET `/api/directory/brands`** ← `listBrands()`

- **作用**：品牌方下拉框
- **返回字段**（`brands` 全表）：`id` / `name` / `contact` / `remark` / `created_at`
- **真实样例**：`[ { "id": 2, "name": "台铃", "contact": null, "remark": "台铃换电", "created_at": "..." } ]`

---

#### ② 展开某张电表时（懒加载）

---

**4️⃣ GET `/api/cabinets?meterId={id}`** ← `listCabinets({meterId})`

- **作用**：展开电表卡片后，加载该电表下的柜子列表；前端用它算「柜数」（`Math.max(1, 柜子数)`）
- **请求参数**：`meterId`（电表ID）
- **返回字段**（`cabinets` 表 + 联表）：

| 字段 | 类型 | 来源 | 含义 |
|---|---|---|---|
| id | int | cabinets | 柜子ID |
| meter_id | int | cabinets | 所属电表ID |
| cabinet_no | varchar(50) | cabinets | 柜子编号（如 luoSiWan-gui-001） |
| cabinet_type | varchar(20) | cabinets | 充电柜 / 储电柜 |
| brand_id | int | cabinets | 品牌方ID（可为空） |
| remark | text | cabinets | 备注 |
| meter_no / meter_name | - | JOIN meters | 电表号/名称 |
| brand_name | - | JOIN brands | 品牌名 |

- **真实样例**：
```json
[ { "id": 1, "meter_id": 2, "cabinet_no": "luoSiWan-gui-001", "cabinet_type": "充电柜", "brand_id": null, "remark": null } ]
```

> 📌 注意：`cabinets` 表在 init.sql / migrations 里**都没有建表脚本**，是手工建的。当前运行库存在该表。

---

#### ③ 打开表单时（MeterForm / ReadingForm）

---

**5️⃣ GET `/api/stations?landlordId={id}`** ← `listStations()`

- **作用**：新增/编辑电表时，选完场地方后加载「该场地方下的站点」下拉
- **请求参数**：`landlordId`（可空）
- **返回字段**（`stations` + 联表）：`s.*` 全表 + `landlord_name` + `meter_count`（该站点电表数）
  - `stations` 字段：`id / name / code / region / address / landlord_id / company_share / status / latitude / longitude / remark / created_at`
- **真实样例**：
```json
[ { "id": 2, "name": "台铃-螺狮湾站", "code": "260319550056", "region": "官渡", "address": null,
    "landlord_id": 4, "landlord_name": "螺蛳湾", "status": "运营中", "company_share": null,
    "latitude": 25.0181411, "longitude": 102.7619552, "meter_count": 1 } ]
```

---

**6️⃣ GET `/api/directory/entities`** ← `listEntities()`

- **作用**：表单里「报税公司主体」下拉
- **返回字段**（`entities` 全表）：`id` / `name` / `short_name` / `remark` / `created_at`
- **真实样例**：`[ { "id": 1, "name": "财税1", "short_name": null, "remark": null, "created_at": "..." } ]`

---

**7️⃣ GET `/api/meter-energy/monthly?meterNo={no}`** ← `getMeterReadings(meterNo)`

- **作用**：录入读数弹窗打开时，加载该电表**所有历史月度读数**（用于回填表单 + 月份快捷切换）
- **请求参数**：`meterNo`（电表编号）；后端可加 `startMonth/endMonth`
- **返回字段**（`meter_monthly` 表 + 联表）：

| 字段 | 类型 | 含义 |
|---|---|---|
| id | int | 读数记录ID |
| address | varchar | 电表编号（= meters.meter_no） |
| month_period | varchar(6) | 月份 YYYYMM |
| kwh | numeric(14,2) | 当月用电量（度） |
| prev_reading_date | date | 上月抄表时间 |
| prev_reading | numeric(14,2) | 起始度数 |
| curr_reading_date | date | 本月抄表时间 |
| curr_reading | numeric(14,2) | 抄表度数 |
| raw_data | jsonb | 第三方原始数据 |
| synced_at | timestamp | 同步时间 |
| meter_name / station_id / station_name | - | JOIN meters/stations |

- **真实样例**：
```json
[ { "address": "251201030462", "month_period": "202608", "kwh": 1946.50,
    "prev_reading_date": "2026-08-01", "prev_reading": 4821.00,
    "curr_reading_date": "2026-08-07", "curr_reading": 6767.50,
    "synced_at": "2026-08-07 03:27:00" } ]
```

---

#### ④ 页面会「写」的数据（这一步影响别的页面）

| 操作 | 调用的接口 | 写入目标 | 副作用（关键！） |
|---|---|---|---|
| 新增/编辑电表 | POST `/api/meters` / PUT `/api/meters/{id}` | `meters` 表 | **保存成功后前端自动调 POST `/api/electricity/generate`（不带 stationId）→ 重算当月全部站点电费台账**，并 invalidate `["electricity"]` |
| 删除电表 | DELETE `/api/meters/{id}` | 先删 `electricity_meter_details` 再删 `meters` | 只 invalidate `["meters"]`，**不重算电费** |
| 添加柜子 | POST `/api/cabinets` | `cabinets` 表 | invalidate `["cabinets"]`，无重算 |
| 编辑/删除柜子 | PUT/DELETE `/api/cabinets/{id}` | `cabinets` 表 | 同上 |
| 录入读数 | POST `/api/meter-energy/readings` | `meter_monthly`（UPSERT `(address, month_period)`） | **保存后调 POST `/api/electricity/generate`（带 stationId）→ 只重算当前站点当月**，invalidate `["electricity"]` |
| 刷新电表数据 | POST `/api/meter-energy/sync?type=…` | 七步：devices/collectors/status/hourly/daily/monthly/warnings → 写 meter_devices、meter_status_cache、meter_hourly/daily/monthly/yearly、sync_logs | 每日限 10 次（localStorage 记次） |

> 🔑 **generate 是 Meters 页影响全系统的关键动作**（backend/app/api/electricity.py）：
> 读取 `meter_monthly` 度数 × `transformer_ratio` → 通过 `station_id → stations.landlord_id → contracts` 取单价（场地合同=付款价、品牌合同=收款价）→ 写入 `electricity_records` + `electricity_meter_details`。
> 新增电表走「全量重算」，录读数走「单站重算」，两者范围不一致。

---

#### ⑤ 页面内部派生/展示的数据（不落库，纯前端）

- 按 **场地方分组** 展示：以 `landlord_id` 分组，`landlord_id` 为 NULL 的归入「未设置场地方」
- **柜数** = `Math.max(1, cabinets.data.length)`（前端从柜子列表数出来）
- 搜索/筛选（关键字、场地方、品牌方）：**全部前端 filter**，不再请求后端
- 导出 Excel：由当前筛选后的 rows 客户端生成（字段：场地方/品牌方/电表编号/电表名称/采集器号/互感器倍数/状态）

#### ⑥ 顺带发现

1. **新增 vs 录读数的重算范围不一致**：新增电表 `generateElectricity({period})` 全量重算；录读数 `{period, stationId}` 单站重算。
2. `getMeter`（GET `/api/meters/{id}`，返回实时状态+能耗）被 import 但页内没用到，死代码。
3. `meters` 表的 `landlord_id` / `entity_id` 是 **init.sql 里没有、运行库里有**（ALERT 加的），schema 与脚本不同步。
4. `cabinets` 表无建表脚本，为手工创建。

---

### Contracts（合同）页 — 已完成

页面文件：`src/pages/Contracts.tsx` ｜ API 层：`src/api/contracts.ts`
后端：`backend/app/repositories/contract_repo.py`

> 页面包含 2 个子部件：合同列表（主） + 合同表单(ContractForm)。合同类型是核心维度：**场地合同=成本**（公司付业主）、**品牌方合同=收入**（品牌方付公司）。

---

#### ① 进入页面时（挂载即请求）

**1️⃣ GET `/api/contracts`** ← `listContracts()`

- **作用**：合同主列表
- **请求参数**：`keyword`(站点/合作方)、`brandId`、`landlordId`、`contractType`（页面筛选时传，初始不传 → 全表）
- **返回字段**：`contracts` 全表 + 联表 + **4 个运行时计算的派生字段**：

| 字段 | 类型 | 来源 | 含义 |
|---|---|---|---|
| id | int | contracts | 合同ID |
| brand_id / brand_name | int/varchar | contracts + JOIN brands | 品牌方 |
| station_id / station_name | int/varchar | contracts（station_name 是手填的冗余字段） | 站点 |
| landlord_id / landlord_name | int/varchar | contracts + JOIN landlords | 场地方 |
| contract_type | varchar | contracts | **场地合同 / 品牌方合同** |
| electricity_price | numeric(8,4) | contracts | 电费单价（税前） |
| tax_enabled / tax_rate / post_tax_electricity_price | bool/numeric | contracts | 税后电费开关/税率/税后单价 |
| rent_amount | numeric(12,2) | contracts | 年租金 |
| unit_monthly_rent | numeric(10,2) | contracts | 单柜场地月租（品牌方合同） |
| cabinets_count | numeric(8,2) | contracts | 计费柜数（存储值） |
| monthly_rent | numeric(12,2) | contracts | 场地月租金 |
| rent_calc_method | varchar | contracts | 按柜子数量 / 固定价格 |
| pay_method / pay_status | varchar | contracts | 付款方式/状态 |
| deposit | numeric | contracts | 押金 |
| first_month_rent / rent_refund | numeric | contracts | 首月场地租金 / 场地费退款 |
| start_date / end_date / early_end_date | date | contracts | 起止 / 提前结束日期 |
| rent_tax_enabled / rent_tax_rate / post_tax_rent_price | - | contracts | 租金税相关 |
| partner / pay_entity / address / remark | - | contracts | 合作方/付款主体/地址/备注 |
| **live_cabinets_count** | int | **运行时子查询** | 该 landlord+brand 下 `cabinets JOIN meters` 的**实时柜数** |
| **venue_monthly_rent** | numeric | **运行时子查询** | 该 landlord 第一份**场地合同**的月租金 |
| **total_brand_cabinets** | int | **运行时子查询** | 该 landlord 所有**品牌方合同**的柜数总和 |
| **venue_cost** | numeric | **运行时计算** | 品牌方合同「承担场地成本」= `venue_rent ÷ 总柜数 × 该合同柜数` |
| **days_left** | int | **运行时计算** | 距结束天数（优先 early_end_date） |
| **status** | varchar | **运行时计算** | 正常/临期(≤90天)/已到期/提前结束/未知 |

- **真实数据样例**（场地合同 + 品牌方合同各一）：
```json
{ "id": 5, "contract_type": "场地合同", "station_name": "官南大道", "landlord_id": 5, "landlord_name": "官南大道",
  "brand_id": null, "brand_name": null, "electricity_price": 0.5000, "tax_enabled": false, "tax_rate": 0.01,
  "rent_amount": 12000.00, "unit_monthly_rent": null, "cabinets_count": null, "monthly_rent": 1000.00,
  "deposit": null, "start_date": "2025-01-31", "end_date": "2027-01-01", "pay_method": "月付",
  "venue_cost": null, "live_cabinets_count": null }
```
```json
{ "id": 6, "contract_type": "品牌方合同", "station_name": "官南大道", "landlord_id": 5, "landlord_name": "官南大道",
  "brand_id": 2, "brand_name": "台铃", "electricity_price": 1.0000, "tax_enabled": true, "tax_rate": 0.01,
  "post_tax_electricity_price": 0.9900, "rent_amount": 60000.00, "unit_monthly_rent": 200.00,
  "cabinets_count": 4.00, "monthly_rent": 800.00, "deposit": null, "start_date": "2025-01-31", "end_date": "2027-01-01",
  "pay_method": "月付", "venue_cost": 250.00 }
```
> 注：`venue_cost` 不存在于 contracts 表，是 repo 查询时算好附加上去的（见下面「⑤ 顺带发现」）。

---

**2️⃣ GET `/api/directory/landlords`** ← `listLandlords()`（与 Meters 页共用）
- 场地方筛选下拉。返回 `landlords` 全表：`id/name/contact/phone/remark/created_at`

**3️⃣ GET `/api/directory/brands`** ← `listBrands()`（与 Meters 页共用）
- 品牌方筛选下拉。返回 `brands` 全表：`id/name/contact/remark/created_at`

---

#### ② 打开表单时（ContractForm）

| # | 前端调用 | 后端接口 | 用途 |
|---|---|---|---|
| 4 | `listStations()` | GET `/api/stations` | 站点下拉（本页表单其实没用到站点选择，station_name 用场地方名带出） |
| 5 | `listBrands()` | GET `/api/directory/brands` | 品牌方选择（仅品牌方合同） |
| 6 | `listLandlords()` | GET `/api/directory/landlords` | 关联场地选择 |
| 7 | `listMeters()` | GET `/api/meters` | **全量电表**，用于自动算柜数 |
| 8 | `listCabinets()` | GET `/api/cabinets` | **全量柜子**，用于自动算柜数 |

> 🔑 **autoCabinetCount（表单核心联动）**：选中 landlord+brand 后，前端拿 `meters.data.filter(landlord_id==L && brand_id==B)` 得到电表 → 取这些电表的 id 集合 → 数 `cabinets.data` 里 `meter_id ∈ 集合` 的个数 → **自动填进 `cabinets_count`**（Contracts.tsx:371-388）。显示「（来自电表管理）」，可点「去修改」跳转 `/meters?landlord=..&brand=..&highlight=cabinet`。

---

#### ③ 页面会「写」的数据

| 操作 | 接口 | 写入目标 | 副作用 |
|---|---|---|---|
| 新增/编辑合同 | POST/PUT `/api/contracts` | `contracts` 表（**全部 29 个字段**，含 tax/rent 系列） | **保存后 `queryClient.invalidateQueries()` 无参数 → 全量失效所有缓存**，所有页面重新请求 |
| 删除合同 | DELETE `/api/contracts/{id}` | 删 contracts 行 | invalidate `["contracts"]` |

> 表单提交时前端做两个计算：
> - **税后电费单价** = `electricity_price ÷ (1+tax_rate)`（tax_enabled 时）
> - **税后场地租金单价** = `monthly_rent ÷ (1+rent_tax_rate)`（rent_tax_enabled 时）
> - 若填了 rent_refund（场地费退款）>0，**自动把 early_end_date 设为今天**（若没填）

---

#### ④ 页面内部派生的数据（不落库，纯前端）

- **按场地方分组**，每组拆成「场地合同(成本)」/「品牌方合同(收入)」两个表
- **月成本 / 月收入 / 月利润**：组内所有合同 `monthly_rent` 求和后相减
- **统计卡片**：合同总数/正常/临期/已到期/提前结束（按 status 前端计数）
- **按年份过滤**：合同有效期与所选年份有交集（start~end/early_end）
- **计费柜数展示**：优先 `live_cabinets_count`（实时），否则 `cabinets_count`（存储值）
- 月租金 ↔ 年租金互算（×12 / ÷12）；导出 Excel 由当前 rows 客户端生成

#### ⑤ 顺带发现

1. **`venue_cost` 是「运行时计算」不是存储列**：后端在 `list_contracts` 里对每条品牌方合同算 `venue_rent ÷ total_brand_cabinets × live_cabinets`。同一 landlord 的场地合同月租金被**平均摊到所有品牌方柜数**，再按本合同柜数分摊——这是「承担场地成本」的口径。
2. **`station_name` 是手填冗余**：contracts 表有 `station_id` 外键但 `station_name` 是文本字段，表单里直接用场地方名带出，不一定等于 stations 表真实站名。
3. **`cabinets_count` 双源**：存储值（表单 auto 填）vs `live_cabinets_count`（实时子查询），页面展示优先实时，但**generate 电费/分红时读的可能是存储值**（见第二步）。
4. **保存后全量 invalidate**：`invalidateQueries()` 无 key → 所有页面的缓存全失效重刷，比 Meters 页的定向失效重得多。

---

### Shareholders（股东分红）页 — 已完成

页面文件：`src/pages/Shareholders.tsx`（2211 行，全系统最深）
API 层：`src/api/dividends.ts` `src/api/overview.ts` `src/api/rent.ts` `src/api/approvals.ts` `src/api/directory.ts`
后端：`dividends.py` `overview.py` `rent.py` `approvals.py` + 核心引擎 `domain/dividend_calc.py`

> 页面有 **两种视图**：`shareholder`（股东汇总）/ `station`（场地汇总），各自拉不同接口。本页**消费 6 类数据源**：档案（股东/介绍人/平台人员）、看板（station-board）、分红（配置/计算/记录/汇总）、运营费用、合同、电表能耗。

---

#### ① 视图 = 股东汇总（shareholder）时

| # | 前端调用 | 后端接口 | 返回什么 |
|---|---|---|---|
| 1 | `listShareholders()` | GET `/api/directory/shareholders` | 股东列表（id/name/phone/remark） |
| 2 | `shareholderSummary({period})` | GET `/api/dividends/summary/shareholder` | 该月**股东分红汇总**（按股东聚合） |
| 3 | `listShareholderConfigs()` | GET `/api/dividends/configs/shareholder` | **全部股东分红配置**（用于显示股东关联的站点） |
| 4 | `getStationBoard({period})` | GET `/api/overview/station-board` | 站点看板（股东详情里展示各站点经营数据） |
| 5 | `calculateDividend({stationId, period})` × N | POST `/api/dividends/calculate` | 对股东配置涉及的**每个站点**分别算分红预估（useQueries 并发） |

#### ② 视图 = 场地汇总（station）时

| # | 前端调用 | 后端接口 | 返回什么 |
|---|---|---|---|
| 6 | `getStationBoard({period})` | GET `/api/overview/station-board` | 站点看板（左侧场地方列表 + 右侧经营指标） |
| 7 | `listShareholderConfigs({stationId})` | GET `/api/dividends/configs/shareholder` | 该站点股东分红配置 |
| 8 | `listIntroducerConfigs({stationId})` | GET `/api/dividends/configs/introducer` | 该站点商务分红配置 |
| 9 | `listDividends({stationId, period})` | GET `/api/dividends` | 该站该月分红记录（含 shares 明细） |
| 10 | `calculateDividend({stationId, period})` | POST `/api/dividends/calculate` | 该站该月分红预估（预览用） |
| 11 | `listExpenses({stationId, period})` | GET `/api/rent/expenses` | 该站该月运营费用 |

#### ③ 弹窗时拉取

| # | 弹窗 | 前端调用 | 接口 |
|---|---|---|---|
| 12 | 配置分红 | `listShareholders()` / `listIntroducers()` | GET `/api/directory/shareholders` `/introducers` |
| 13 | 提交审批 | `listPlatformUsers()` | GET `/api/directory/platform-users`（筛选 finance_supervisor/boss 角色） |
| 14 | 导出（场地汇总） | `listContracts({landlordId})` | GET `/api/contracts` |
| 15 | 导出（场地汇总） | `getStationEnergy(stationId)` | GET `/api/meter-energy/station/{id}` |
| 16 | 导出（场地汇总） | `getMonthlyKwh({meterNo,...})` × N | GET `/api/meter-energy/monthly`（每电表各月读数） |
| 17 | 导出（两视图） | `getStationBoard({period})` × 多月 | GET `/api/overview/station-board` |

---

#### ④ 核心接口的返回结构（这两个是本页的计算核心）

**A. GET `/api/overview/station-board`** — 按场地方分组，每条含：

| 字段 | 内容 |
|---|---|
| landlord | {id, name, contact, phone} |
| meters | 该 landlord 下电表（id/meter_no/brand_id/brand_name/transformer_ratio/status） |
| stations | 该 landlord 下站点（id/name/company_share/status） |
| meterCount / stationCount | 计数 |
| totalKwh | 该月该场地总度数（meter_monthly 按 meter_no=address 汇总） |
| elecPay / elecCollect / elecProfit | 电费成本/收入/利润 = 度数 × 场地合同单价 / 度数 × 品牌方合同单价 |
| rentCost / rentIncome / rentProfit | 场地租金成本/收入/利润（合同 monthly_rent） |
| opExpense | 运营费用合计（operating_expenses，按站点查） |
| totalProfit | `elecProfit + rentProfit - opExpense` |
| stationBreakdown | 按站点拆分：kwh/elecPay/elecCollect/elecProfit |
| contractBreakdown | 合同明细：type/partner/monthlyRent/elecPrice/cabinetsCount |

**B. POST `/api/dividends/calculate`** — 分红计算器（dividend_calc.py），返回：

| 字段 | 内容 |
|---|---|
| income | `elecIncome{total, details[per-meter]}` + `rentIncome{total, details[per-brand 含首月租]}` + `totalIncome` |
| cost | `elecCost / rentCost / opExpense / elecTax / rentTax / rentRefund / bizDividendCost / totalCost` + `details`（含 electricity/rent/operatingExpense/elecTax/rentTax/rentRefund 明细） |
| profit | 净利润 = totalIncome - totalCost |
| brandBreakdown | 按品牌 P&L：brandId/brandName/elecIncome/rentIncome/income/venueCost/elecCost/opExpense/cost/profit |
| shareholderDividends | [{shareholderId, shareholderName, brandId, brandName, mode, ratio, fixedAmount, baseAmount, amount, settlementPeriod}] |
| bizDividends | [{introducerId, ..., countAsCost, baseAmount, amount, ...}] |
| settlementDate | 结算日期 |
| summary | totalBusinessDividend / totalShareholderDividend |

> 🔑 计算器的数据来源（不读 electricity_records 台账！）：`station_repo.get_station` → `_get_contracts`（按 landlord_id 或 station_name）→ `_get_meter_kwh`（**按 meters.landlord_id** 查 meter_monthly）→ `rent_repo.get_expense` → `list_shareholder_configs` / `list_introducer_configs`（**按 start_date/end_date 过滤生效期**）。税费：税后单价品牌用 `kwh×(税前−税后)` 单算 elecTax。

---

#### ⑤ 页面会「写」的数据

| 操作 | 接口 | 写入目标 | 副作用 |
|---|---|---|---|
| 新增股东 | POST `/api/directory/shareholders` | shareholders | invalidate `["shareholders"]` |
| 配置股东/商务分红 | POST `/api/dividends/configs/{shareholder,introducer}` | config 两表 | invalidate `["shareholderConfigs","introducerConfigs","dividendPreview","stationBoard"]` |
| 删除配置 | DELETE `/api/dividends/configs/...` | 同上 | 同上 |
| 新增运营费用 | POST `/api/rent/expenses` | operating_expenses | invalidate `["expenses","dividendPreview","stationBoard"]` |
| 删除/编辑费用 | DELETE/PUT `/api/rent/expenses` | 同上 | 同上 |
| 新增分红月结 | POST `/api/dividends` | dividend_records + dividend_shares（**用 calculate 结果落库**） | invalidate `["dividends","stationDividends","dividendPreview","shareholderSummary"]` |
| 提交审批 | POST `/api/approvals` | approval_requests + 分红状态→申报中 | invalidate `["stationDividends","approvals"]` |

> ⚠️ 注意：前端 import 了 `submitDividend`/`approveDividend`/`settleDividend` 等，但**页面实际提交审批用的是 `submitDividendApproval`（POST /api/approvals）**，不是 `/dividends/{id}/submit`——两条审批路径并存（见 Approvals 页）。

#### ⑥ 页面内部派生的数据（不落库）

- **股东汇总合并**：`shareholders`（全股东，含无记录的）× `shareholderSummary`（有记录的）合并成一个 Map，无记录股东金额为 0
- **预估分红金额**（前端算，仅展示）：
  - 收入分红：`estIncomeBase × ratio`（有 brand 配置用 brandBreakdown.income，否则用 elecCollect+rentIncome）
  - 利润分红：`estProfitBase × ratio`（brand 用 brandBreakdown.profit，否则 totalProfit）
  - 固定金额：直接 `fixed_amount`
- **场地汇总导出 Excel**：前端自己从 listContracts + getStationEnergy + getMonthlyKwh 重新算每站每月度数×单价=收款/付款，**另算一套**（`collectNet = collectAmount/1.01`、再 `-500`「陈俊文垫付」）——与后端 calculate 口径不同（见第二步）
- **股东汇总导出 Excel**：按 configs 的 ratio ×（月租金×月数 − 10% 商务分红）

#### ⑦ 顺带发现（重大）

1. **运行库 config 表 schema 与 init.sql 完全不同**（P6 实锤升级）：
   - 运行库 `station_shareholder_configs` **有** `brand_id / start_date / end_date` 列，唯一索引改为**按 brand_id 拆分的两个部分索引**：`(station_id, brand_id, shareholder_id) WHERE brand_id IS NOT NULL` + `(station_id, shareholder_id) WHERE brand_id IS NULL`
   - 而 `database_init.sql:75-85` 仍是无 brand_id/start_date/end_date + `UNIQUE(station_id, shareholder_id)`
   - **说明：现网表已被 ALTER 过（可能是手工或某个未入库的迁移），但 init.sql 没同步** —— 这正是 P6「脚本与库漂移」的完整证据。且按 brand_id 拆索引后，`save_shareholder_config` 的 COALESCE(brand_id,0) 匹配逻辑才成立。
2. **`dividend_shares` 表也有 `brand_id` 列**（init.sql 没有），同样是 ALTER 加的。
3. **`station_name` 冗余字段再次出现**：config 表的 station_name 由 JOIN stations 带出，contracts 表则是手填文本，两处可能不一致。
4. **两条利润计算路径在本页交汇**：页面同时用 `stationBoard.totalProfit`（看板算法）和 `calculateDividend().profit`（分红算法），两处对账容易对不上（见 DATA_GOVERNANCE.md P1）。

---

## 第二步 · 跨页引用 / 计算 / 产出（待全部页面梳理完后进行）

---

> 生成时间：2026-08-07
> 数据样例来源：Postgres `huandian_v2`（docker 容器 `postgres-quant`）
