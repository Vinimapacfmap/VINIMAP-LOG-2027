-- -------------------------------------------------------------
-- SQL Migration Schema for Supabase (PostgreSQL)
-- Application: Vinimap Logistics OS
-- Target Platform: Supabase Database (PostgreSQL)
-- Generated on: 2026-07-18
-- -------------------------------------------------------------

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: COMPANY_HUBS (Company central hubs)
CREATE TABLE IF NOT EXISTS company_hubs (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    address TEXT NOT NULL,
    cep VARCHAR(10) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Table: CLIENT_PARTNERS (Business partners and clients)
CREATE TABLE IF NOT EXISTS client_partners (
    id VARCHAR(100) PRIMARY KEY,
    codigo_cliente VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    tel VARCHAR(50),
    addr TEXT,
    status VARCHAR(50) DEFAULT 'Ativo',
    type VARCHAR(20) DEFAULT 'Parceiro' CHECK (type IN ('Cliente', 'Parceiro')),
    cnpj VARCHAR(20),
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep_ranges JSONB DEFAULT '[]'::jsonb, -- Array of {id, cepStart, cepEnd, value, description}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Table: DELIVERY_RIDERS (Drivers / Couriers)
CREATE TABLE IF NOT EXISTS delivery_riders (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    vehicle VARCHAR(50) DEFAULT 'Moto' CHECK (vehicle IN ('Moto', 'Bicicleta', 'Carro', 'Elétrico')),
    rating NUMERIC(3, 2) DEFAULT 5.0,
    status VARCHAR(50) DEFAULT 'Offline' CHECK (status IN ('Disponível', 'Em rota', 'Alerta', 'Offline')),
    phone VARCHAR(50),
    lat NUMERIC(10, 6) DEFAULT 0.0,
    lng NUMERIC(10, 6) DEFAULT 0.0,
    completed_deliveries INT DEFAULT 0,
    current_order_id VARCHAR(100),
    battery_percent INT DEFAULT 100 CHECK (battery_percent BETWEEN 0 AND 100),
    billing_model VARCHAR(50) DEFAULT 'misto' CHECK (billing_model IN ('misto', 'fixo', 'variavel', 'frete')),
    billing_fixed_fee NUMERIC(10, 2) DEFAULT 0.00,
    billing_variable_percent NUMERIC(5, 2) DEFAULT 0.00,
    billing_freight_percent NUMERIC(5, 2) DEFAULT 0.00,
    exibir_valor_turno BOOLEAN DEFAULT TRUE NOT NULL,
    ocultar_valores_protocolos BOOLEAN DEFAULT FALSE NOT NULL,
    device_number VARCHAR(100),
    password VARCHAR(100),
    address TEXT,
    cpf_cnpj VARCHAR(20),
    vehicle_plate VARCHAR(20),
    cnh VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Table: ORDERS (Delivery Orders)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT NOT NULL,
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Não iniciado' CHECK (status IN ('Não iniciado', 'Em rota', 'Entregando', 'Concluído', 'Cancelado', 'Ocorrência')),
    priority VARCHAR(20) DEFAULT 'Média' CHECK (priority IN ('Baixa', 'Média', 'Alta')),
    value NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    rider_id VARCHAR(100) REFERENCES delivery_riders(id) ON DELETE SET NULL,
    items_count INT DEFAULT 1 NOT NULL,
    date DATE NOT NULL,
    cep VARCHAR(10),
    partner_name VARCHAR(255),
    delivery_value NUMERIC(10, 2) DEFAULT 0.00,
    driver_value NUMERIC(10, 2) DEFAULT 0.00,
    raw_data JSONB DEFAULT '{}'::jsonb,
    history JSONB DEFAULT '[]'::jsonb, -- Array of history log entries
    protocol_number VARCHAR(100),
    signature_url TEXT,
    delivery_photo_url TEXT,
    recipient_name VARCHAR(255),
    recipient_doc VARCHAR(50),
    delivery_date VARCHAR(50),
    delivery_time VARCHAR(50),
    sequence INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Table: ACTIVITY_LOGS (System and order logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(100) PRIMARY KEY,
    time VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'danger')),
    order_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6. Table: FINANCIAL_TRANSACTIONS (Transactions log)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id VARCHAR(100) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('payable', 'receivable')),
    amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    actual_payment_date DATE,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado')),
    recipient_or_payer VARCHAR(255),
    payment_method VARCHAR(100),
    notes TEXT,
    cost_type VARCHAR(20) CHECK (cost_type IN ('fixed', 'variable')),
    is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
    recurrence_period VARCHAR(20),
    recurrence_installment INT,
    total_installments INT,
    parent_recurrence_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- -------------------------------------------------------------
-- PERFORMANCE INDICES FOR FAST QUERIES
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_financial_due_date ON financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_category ON financial_transactions(category);

-- -------------------------------------------------------------
-- INITIAL SEED DATA FOR DEMO INTEGRITY
-- -------------------------------------------------------------

-- Seed Company Hubs
INSERT INTO company_hubs (id, name, cnpj, address, cep, lat, lng, phone, active) 
VALUES ('hub-main', 'Sede Ativa Vinimap Principal', '98.765.432/0001-99', 'Rua Cerro Corá, 385, Lapa', '05061-050', -23.5350257, -46.702242, '(11) 3222-1111', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Client Partners
INSERT INTO client_partners (id, codigo_cliente, name, region, tel, addr, status, type, cnpj, cep, cidade, estado, cep_ranges)
VALUES 
('CL1-001', 'CL1-001', 'Ana Silva', 'Centro', '(11) 99123-4567', 'Av. Paulista, 1000', 'Adimplente', 'Parceiro', '12.345.678/0001-00', '01310-100', 'São Paulo', 'SP', '[]'::jsonb),
('CL1-002', 'CL1-002', 'Pedro Santos', 'Centro', '(11) 98234-5678', 'Rua Augusta, 420', 'Adimplente', 'Parceiro', '23.456.789/0001-11', '01303-010', 'São Paulo', 'SP', '[]'::jsonb),
('CL1-003', 'CL1-003', 'Mariana Costa', 'Zona Sul', '(11) 97345-6789', 'Al. Lorena, 1500', 'Ativo', 'Parceiro', '34.567.890/0001-22', '01415-000', 'São Paulo', 'SP', '[]'::jsonb),
('CL1-004', 'CL1-004', 'Beatriz Lima', 'Zona Oeste', '(11) 95567-8901', 'Av. Brigadeiro Faria Lima, 3477', 'Adimplente', 'Parceiro', '45.678.901/0001-33', '01452-000', 'São Paulo', 'SP', '[]'::jsonb),
('CL1-005', 'CL1-005', 'Burger King', 'Centro', '(11) 3003-5464', 'Av. Paulista, 1200', 'Ativo', 'Parceiro', '17.261.661/0001-73', '01311-200', 'São Paulo', 'SP', '[{"id": "bk-r1", "cepStart": "01000-000", "cepEnd": "01399-999", "value": 8.90, "description": "Centro Expandido"}, {"id": "bk-r2", "cepStart": "01400-000", "cepEnd": "01499-999", "value": 11.50, "description": "Jardins / Cerqueira César"}, {"id": "bk-r3", "cepStart": "01500-000", "cepEnd": "01999-999", "value": 10.00, "description": "Liberdade / Bela Vista"}]'::jsonb),
('CL1-006', 'CL1-006', 'Bella Paulista', 'Centro', '(11) 3211-1234', 'Rua Haddock Lobo, 354', 'Ativo', 'Parceiro', '56.789.012/0001-44', '01303-050', 'São Paulo', 'SP', '[{"id": "bella-r1", "cepStart": "01300-000", "cepEnd": "01399-999", "value": 6.00, "description": "Consolação & Bela Vista"}, {"id": "bella-r2", "cepStart": "01200-000", "cepEnd": "01299-999", "value": 8.50, "description": "Higienópolis & Santa Cecília"}, {"id": "bella-r3", "cepStart": "01400-000", "cepEnd": "01499-999", "value": 9.00, "description": "Cerqueira César"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
