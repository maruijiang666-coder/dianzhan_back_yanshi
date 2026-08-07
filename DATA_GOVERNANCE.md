# 换电站经营管理平台 - 数据结构治理清单

> 状态：**只列问题与改法，未动任何代码。**
> 依据代码核验得出，每条给出：现状 → 证据位置 → 影响 → 改法(含推荐与权衡) → 验收标准 → 影响面。
> 严重度标注：🔴 高（影响账目正确性）｜🟠 中（数据口径不一）｜🟡 低（结构/维护成本）｜⚪ 观感。

---

## 零、先做的三件事（不需要改代码，先掌握实情）

治理前先把底数摸清，这几步只读、可回滚：

1. **核验分红配置表结构**（P6 相关，已发现代码与建表脚本矛盾）：
   ```sql
   \d station_shareholder_configs        -- 看有没有 start_date/end_date 列
   \d station_introducer_configs
   ```
   若没有这两列 → 现网「配置分红」功能一直在报错或字段被静默丢弃，需先补列。
2. **找出 landlord 不一致的电表**（P2 相关）：
   ```sql
   SELECT m.id, m.meter_no, m.landlord_id AS meter_landlord, s.landlord_id AS station_landlord
   FROM meters m JOIN stations s ON m.station_id = s.id
   WHERE m.landlord_id IS DISTINCT FROM s.landlord_id;
   ```
3. **对同一站月，比对电费台账 vs 分红预览**（P1 相关）：在页面里选一个月，电费页的利润 与 分红页预览的净利润 是否一致，把不一致的站点记下来。

---

## 一、🔴 高优先级（影响账目正确性）

### P1. 利润有两套计算引擎，税费规则还不一致

| 项 | 内容 |
|---|---|
| **现状** | `electricity.py` 的 generate 生成 `electricity_records`（台账）；`dividend_calc.py` **不读台账、从 meter_monthly + contracts 重新算一遍**利润。两处税费算法不同：台账用 `collect_amount/(1+tax_rate)`；分红对启用税后单价的品牌用 `kwh×(税前−税后)` 另算 `elecTax`。 |
| **证据** | `backend/app/domain/dividend_calc.py:90-117`；`backend/app/api/electricity.py:261-270` |
| **影响** | 同一站月，电费页与分红页的电费收入/利润可能对不上；对外对账单与对内分红是两套数。 |
| **改法** | **推荐：** 让 `dividend_calc` 优先读 `electricity_records` + `electricity_meter_details`（台账缺失时才实时兜底计算），并统一税费口径为一种。**备选：** 维持两套引擎，但把税费算法收敛成同一个公共函数，两侧都调用。 |
| **权衡** | 改计算引擎会影响**未来**的分红预览/生成；历史 `dividend_records` 快照已落库不受影响。改动后需回归：任意站月台账利润 == 分红预览净利润。 |
| **验收** | 抽查 ≥5 个站点 × ≥3 个月，分红预览中 `elecIncome/elecCost/elecTax` 与电费台账完全一致。 |
| **影响面** | Shareholders 页（预览/生成）、Electricity 页、Stations 页、导出 Excel。 |

### P2. 「电表→场地」关系双源，两条匹配路径会算岔

| 项 | 内容 |
|---|---|
| **现状** | `meters.landlord_id` 直接存一份；`meters.station_id → stations.landlord_id` 又是一份。电费生成走 `meter.station_id → station.landlord_id`（electricity.py:216-231），分红计算走 `meters.landlord_id`（dividend_calc.py:292-301）。 |
| **影响** | 电表若只填了站点没填 landlord（或反了），两个页面取到不同度数。 |
| **改法** | **推荐：** 收敛为单一路径——以 `meters.station_id → stations.landlord_id` 为准，建/改电表时由站点带出 landlord_id 强制写入，并加应用层校验。**或** 反向：删 `stations.landlord_id` 依赖，全走 `meters.landlord_id`。选一条，删另一条。 |
| **验收** | 第「零」节 SQL 查出 0 条不一致；两条路径算同一结果。 |
| **影响面** | Meters 表单、electricity/generate、dividend_calc、overview/station-board、station meter-view。 |

### P3. 柜子数两套来源（手填 vs 电表反推）

| 项 | 内容 |
|---|---|
| **现状** | `contracts.cabinets_count` 手填一份；`meters→cabinets` 能数出第二份。合同表单已会自动用后者**覆盖**前者（Contracts.tsx 的 `autoCabinetCount`），但合同仍落库存 `cabinets_count`。 |
| **影响** | 品牌方合同计费柜数与电表实挂柜数可能不一致 → 租金对不上。 |
| **改法** | **推荐：** 合同不再持久化 `cabinets_count`（只存 `unit_monthly_rent`），计费柜数一律实时从 `meters→cabinets` 统计；历史值做一次性对齐。**备选：** 保留存储字段，但增加「两处不一致」的校验/告警。 |
| **验收** | Contracts 表单自动柜数与任何页面看到的柜数恒一致。 |
| **影响面** | ContractForm、Rent 页、Brands/Entities 页、导出。 |

---

## 二、🟠 中优先级（数据口径不一）

### P4. 一套租金，三处记录，互不打通

| 项 | 内容 |
|---|---|
| **现状** | 租金散落在：① `contracts.monthly_rent`；② `rent_leases` / `rent_incomes` / `rent_receipts`；③ **硬编码路径的 Excel** `backend/app/api/rent.py:163` 的 `2026-2027美团场租.xlsx`（运行时解析）。另有年度台账表 `rent_payment_records` / `rent_income_records`（migrations/add_rent_records.sql）。 |
| **影响** | 同一场地租金在多个页面看到不同数字；Excel 缺失/路径变更即接口报错；生产财务数据躺在 Excel 里。 |
| **改法** | **推荐：** 定 `contracts` 为租金主源；把美团 Excel **一次性导入** `rent_incomes`（带 source 标记），之后删除运行时解析；Rent 页改为读库。**备选：** 若 Excel 就是业务真相，则反向把它入库并让 contracts 反查它。 |
| **权衡** | Excel 导入是一次性数据工程，需要人工核对口径（含税/不含税、扣款 500 等）。 |
| **验收** | Rent 页展示的所有数字均来自数据库；`getExcelData` 不再被生产页面依赖。 |
| **影响面** | Rent 页、rent_repo、导出。 |

### P5. 合同表字段有机增长，存储值与派生值混存

| 项 | 内容 |
|---|---|
| **现状** | `contracts` 单表堆了 `venue_cost`（计算值）、`first_month_rent`、`rent_refund`、`early_end_date`、`rent_tax_*`、`deposit`、`post_tax_*` 等一批后补字段。 |
| **影响** | 维护成本高，派生字段容易被改脏（如 venue_cost 与场地合同不同步）。 |
| **改法** | 区分「存储字段」与「派生字段」：`venue_cost` 改为前端实时计算，不落库；税后价、首月租金等保留但加注释说明口径。 |
| **验收** | contracts 表字段按「基础/税务/租金/期次」分组有文档；无重复派生字段落库。 |
| **影响面** | ContractForm、Contracts 页、Brands/Entities 导出。 |

---

## 三、🟡 低优先级（结构/维护成本）

### P6. 分红配置表 schema 漂移 + UNIQUE 语义矛盾（已实锤）

| 项 | 内容 |
|---|---|
| **现状** | `database_init.sql:74-85` 建 `station_shareholder_configs` 时**没有 `start_date/end_date` 列**，且带 `UNIQUE(station_id, shareholder_id)`。但 `dividend_repo.py:50-59` 插入/更新这两列，并 `ON CONFLICT (station_id, shareholder_id) DO UPDATE`；`dividend_calc.py:352-371` 用 `start_date/end_date` 过滤生效期。migrations 目录里**没有任何**给这两张表补列的脚本。 |
| **影响** | ① 若现网列确实不存在，配置分红功能长期在报错/丢字段；② 即使补了列，UNIQUE + DO UPDATE 意味着**同一股东同一站永远只能有一条配置**，UI 的「生效期起止」功能形同虚设。 |
| **改法** | 写迁移补 `start_date/end_date`（NOT NULL DEFAULT / 可空）；把 UNIQUE 改为 `UNIQUE(station_id, shareholder_id, start_date)`（或去掉唯一约束，靠生效期去重）；`ON CONFLICT` 目标随之调整。 |
| **验收** | 能配置同一股东同一站两段不重叠的生效期，且各自参与分红计算。 |
| **影响面** | Shareholders 配置弹窗、dividend_calc、分红生成。 |

### P7. 孤儿代码与脆弱的共享 queryKey

| 项 | 内容 |
|---|---|
| **现状** | `DimensionBoard.tsx`、`Home.tsx` 未被 App.tsx 路由引用（孤儿）；DimensionBoard 里 `listElectricity/listLeases/listIncomes` 导入未用；`["stationBoard"]` queryKey 被 Shareholders/Stations/（孤儿）DimensionBoard 共用，一处 invalidate 全连带刷新。 |
| **影响** | 死代码误导排查；跨页共享 key 造成无谓重刷。 |
| **改法** | 删除或接入孤儿组件；清未用 import；给跨页共享 key 加明确语义（或按页面前缀化）。 |
| **影响面** | 无业务风险，纯清理。 |

---

## 四、⚪ 观感

### P8. 项目文档停留在旧技术栈

| 项 | 内容 |
|---|---|
| **现状** | `PROJECT_UNDERSTANDING.md` 描述 Hono + tRPC + MySQL + Drizzle，实际是 FastAPI + PostgreSQL；`README.md` 部分内容同样过时。`API_DESIGN.md` 是新的、可用。 |
| **改法** | 用本文档 + API_DESIGN.md 更新 PROJECT_UNDERSTANDING.md 的技术栈、页面路由、数据模型章节。 |

---

## 五、建议推进顺序（止血 → 收敛 → 清理）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **第一优先（止血）** | 先跑「零」的三步核验；然后 P2（收敛 landlord 单源）、P1（统一税费/计算引擎）。这两项直接决定「账对不对」。 | 无 |
| **第二优先（收敛）** | P4（Excel 落库 + 租金定主源）、P3（柜数唯一源）、P6（补列 + 改 UNIQUE）。 | 依赖 P2 选定的 landlord 路径 |
| **第三优先（清理）** | P5（contracts 字段归类）、P7（孤儿代码）、P8（文档）。 | 无 |

> 注意顺序：P1/P2 是「先定口径」，P3/P4 是「定主源」，都在动数据语义；建议**每完成一项就回归一次对账**（台账利润 vs 分红净利润），避免多线并发改动后无法定位是谁引入的差异。

---

## 六、一句话结论

核心逻辑健康，但存在**两套利润计算引擎、同一关系多处存储、租金三处记录**这三大类问题。按本清单先「零核验 → P1 → P2 → P4」，就能把「同一笔账不同入口看到不同数字」的问题先压下去；P6 属于隐藏较深的实锤 bug，建议尽早处理。
