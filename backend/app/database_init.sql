-- 换电站管理平台数据库初始化脚本

-- 基础档案表
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    contact VARCHAR(100),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    short_name VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landlords (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    contact VARCHAR(100),
    phone VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shareholders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS introducers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 站点与电表
CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    region VARCHAR(50),
    address VARCHAR(300),
    landlord_id INTEGER REFERENCES landlords(id),
    company_share NUMERIC(5,4),
    status VARCHAR(20) DEFAULT '运营中',
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meters (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    brand_id INTEGER REFERENCES brands(id),
    meter_no VARCHAR(100) NOT NULL UNIQUE,
    meter_name VARCHAR(200),
    collector_id VARCHAR(100),
    transformer_ratio NUMERIC(10,2) DEFAULT 1,
    status VARCHAR(20) DEFAULT '正常',
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 分红配置
CREATE TABLE IF NOT EXISTS station_shareholder_configs (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
    mode VARCHAR(20) NOT NULL,
    ratio NUMERIC(6,4),
    fixed_amount NUMERIC(12,2),
    settlement_period VARCHAR(10) DEFAULT '月',
    remark VARCHAR(200),
    UNIQUE(station_id, shareholder_id)
);

CREATE TABLE IF NOT EXISTS station_introducer_configs (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    introducer_id INTEGER NOT NULL REFERENCES introducers(id),
    mode VARCHAR(20) NOT NULL,
    ratio NUMERIC(6,4),
    fixed_amount NUMERIC(12,2),
    settlement_period VARCHAR(10) DEFAULT '月',
    count_as_cost BOOLEAN DEFAULT FALSE,
    remark VARCHAR(200),
    UNIQUE(station_id, introducer_id)
);

-- 财务数据
CREATE TABLE IF NOT EXISTS electricity_records (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    period VARCHAR(7) NOT NULL,
    pay_start_date DATE,
    pay_start_reading NUMERIC(14,2),
    pay_end_date DATE,
    pay_end_reading NUMERIC(14,2),
    pay_kwh NUMERIC(14,2),
    pay_unit_price NUMERIC(8,4),
    pay_amount NUMERIC(14,2),
    pay_status VARCHAR(20) DEFAULT '未付款',
    collect_start_date DATE,
    collect_start_reading NUMERIC(14,2),
    collect_end_date DATE,
    collect_end_reading NUMERIC(14,2),
    collect_kwh NUMERIC(14,2),
    collect_unit_price NUMERIC(8,4),
    collect_amount NUMERIC(14,2),
    tax_rate NUMERIC(5,4),
    collect_net NUMERIC(14,2),
    collect_status VARCHAR(20) DEFAULT '未到账',
    profit NUMERIC(14,2),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(station_id, period)
);

CREATE TABLE IF NOT EXISTS electricity_meter_details (
    id SERIAL PRIMARY KEY,
    electricity_id INTEGER NOT NULL REFERENCES electricity_records(id),
    meter_id INTEGER NOT NULL REFERENCES meters(id),
    start_reading NUMERIC(14,2),
    end_reading NUMERIC(14,2),
    kwh NUMERIC(14,2),
    pay_unit_price NUMERIC(8,4),
    pay_amount NUMERIC(14,2),
    collect_unit_price NUMERIC(8,4),
    collect_amount NUMERIC(14,2),
    collect_net NUMERIC(14,2)
);

CREATE TABLE IF NOT EXISTS operating_expenses (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    period VARCHAR(7) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(station_id, period)
);

CREATE TABLE IF NOT EXISTS rent_leases (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    contract_start DATE,
    contract_end DATE,
    annual_rent NUMERIC(12,2),
    pay_method VARCHAR(50),
    pay_amount NUMERIC(12,2),
    deposit NUMERIC(12,2),
    pay_deadline DATE,
    pay_status VARCHAR(20) DEFAULT '未付款',
    invoice_type VARCHAR(20),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rent_incomes (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    brand_id INTEGER REFERENCES brands(id),
    contract_start DATE,
    contract_end DATE,
    unit_monthly_rent NUMERIC(10,2),
    cabinets_count NUMERIC(8,2),
    monthly_rent NUMERIC(12,2),
    annual_income NUMERIC(12,2),
    tax_rate NUMERIC(5,4),
    annual_income_net NUMERIC(12,2),
    input_cost NUMERIC(12,2),
    profit NUMERIC(12,2),
    sign_status VARCHAR(100),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rent_receipts (
    id SERIAL PRIMARY KEY,
    rent_income_id INTEGER NOT NULL REFERENCES rent_incomes(id),
    seq NUMERIC(3,0) NOT NULL,
    period_start DATE,
    period_end DATE,
    amount NUMERIC(12,2),
    status VARCHAR(20) DEFAULT '未到账',
    remark VARCHAR(200)
);

-- 分红记录
CREATE TABLE IF NOT EXISTS dividend_records (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id),
    period VARCHAR(7) NOT NULL,
    type VARCHAR(20) NOT NULL,
    elec_income NUMERIC(14,2),
    rent_income NUMERIC(14,2),
    total_income NUMERIC(14,2),
    elec_cost NUMERIC(14,2),
    rent_cost NUMERIC(14,2),
    op_expense NUMERIC(14,2),
    biz_dividend_cost NUMERIC(14,2),
    total_cost NUMERIC(14,2),
    profit NUMERIC(14,2),
    status VARCHAR(20) DEFAULT '未结算',
    settlement_date DATE,
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dividend_shares (
    id SERIAL PRIMARY KEY,
    dividend_id INTEGER NOT NULL REFERENCES dividend_records(id),
    introducer_id INTEGER REFERENCES introducers(id),
    shareholder_id INTEGER REFERENCES shareholders(id),
    mode VARCHAR(20) NOT NULL,
    ratio NUMERIC(6,4),
    fixed_amount NUMERIC(12,2),
    amount NUMERIC(14,2),
    remark VARCHAR(200)
);

-- 合同
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    station_id INTEGER REFERENCES stations(id),
    station_name VARCHAR(200) NOT NULL,
    landlord_id INTEGER REFERENCES landlords(id),
    brand_id INTEGER REFERENCES brands(id),
    contract_type VARCHAR(20) NOT NULL DEFAULT '场地合同',
    electricity_price NUMERIC(8,4),
    rent_amount NUMERIC(12,2),
    cabinets_count NUMERIC(8,2),
    unit_monthly_rent NUMERIC(10,2),
    monthly_rent NUMERIC(12,2),
    rent_calc_method VARCHAR(20) DEFAULT '按柜子数量',
    pay_method VARCHAR(50),
    address VARCHAR(300),
    partner VARCHAR(150),
    pay_entity VARCHAR(150),
    start_date DATE,
    end_date DATE,
    pay_status VARCHAR(20) DEFAULT '未付款',
    tax_enabled BOOLEAN DEFAULT FALSE,
    tax_rate NUMERIC(6,4) DEFAULT 0.01,
    post_tax_electricity_price NUMERIC(8,4),
    remark TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 审批
CREATE TABLE IF NOT EXISTS approval_flows (
    id SERIAL PRIMARY KEY,
    biz_type VARCHAR(50) NOT NULL UNIQUE,
    nodes TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    biz_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    reason TEXT,
    amount NUMERIC(14,2),
    applicant VARCHAR(100) NOT NULL,
    attachments TEXT,
    flow_nodes TEXT NOT NULL,
    current_node INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT '审批中',
    urge_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_records (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES approval_requests(id),
    node_index INTEGER NOT NULL,
    node_name VARCHAR(100),
    approver VARCHAR(100),
    action VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 第三方数据缓存
CREATE TABLE IF NOT EXISTS meter_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50),
    collector_id VARCHAR(50),
    address VARCHAR(100) UNIQUE,
    description VARCHAR(200),
    rate NUMERIC(10,2),
    meter_id INTEGER REFERENCES meters(id),
    synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_monthly (
    id SERIAL PRIMARY KEY,
    address VARCHAR(100) NOT NULL,
    month_period VARCHAR(6) NOT NULL,
    kwh NUMERIC(14,2),
    raw_data JSONB,
    synced_at TIMESTAMP,
    UNIQUE(address, month_period)
);

CREATE TABLE IF NOT EXISTS meter_status_cache (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50),
    address VARCHAR(100),
    c0 NUMERIC(14,2),
    c1 NUMERIC(14,2),
    c2 NUMERIC(14,2),
    c3 NUMERIC(14,2),
    c4 NUMERIC(14,2),
    remain_money NUMERIC(14,2),
    synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_warnings_cache (
    id SERIAL PRIMARY KEY,
    device_type INTEGER,
    device_id VARCHAR(50),
    device_address VARCHAR(100),
    warning_def_id INTEGER,
    start_time TIMESTAMP,
    msg TEXT,
    synced_at TIMESTAMP
);

-- 小时用电量
CREATE TABLE IF NOT EXISTS meter_hourly (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    address VARCHAR(100),
    hour_time VARCHAR(10) NOT NULL,
    kwh NUMERIC(14,2),
    raw_data JSONB,
    synced_at TIMESTAMP,
    UNIQUE(device_id, hour_time)
);

-- 日用电量
CREATE TABLE IF NOT EXISTS meter_daily (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    address VARCHAR(100),
    day_date VARCHAR(8) NOT NULL,
    kwh NUMERIC(14,2),
    raw_data JSONB,
    synced_at TIMESTAMP,
    UNIQUE(device_id, day_date)
);

-- 年用电量
CREATE TABLE IF NOT EXISTS meter_yearly (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    address VARCHAR(100),
    year_period VARCHAR(4) NOT NULL,
    kwh NUMERIC(14,2),
    raw_data JSONB,
    synced_at TIMESTAMP,
    UNIQUE(device_id, year_period)
);

-- 采集器
CREATE TABLE IF NOT EXISTS meter_collectors (
    id VARCHAR(50) PRIMARY KEY,
    collector_id VARCHAR(50),
    description VARCHAR(200),
    device_count INTEGER DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMP
);

-- 同步日志
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
