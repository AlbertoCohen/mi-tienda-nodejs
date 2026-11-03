CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP VIEW IF EXISTS v_dynamic_menu CASCADE;
DROP TABLE IF EXISTS fiscal_invoices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS shipping_providers CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS promotion_redemptions CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TYPE user_role_t AS ENUM ('superadmin', 'admin', 'customer');
CREATE TYPE season_t AS ENUM ('Invierno', 'Verano', 'Ambas');
CREATE TYPE gender_target_t AS ENUM ('hombre', 'mujer_dama', 'unisex', 'ninos');
CREATE TYPE cart_status_t AS ENUM ('active', 'abandoned', 'converted');
CREATE TYPE order_status_t AS ENUM ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE shipment_status_t AS ENUM ('draft', 'ready_to_ship', 'in_transit', 'delivered', 'failed', 'returned');
CREATE TYPE invoice_type_t AS ENUM ('A', 'B', 'C');
CREATE TYPE arca_status_t AS ENUM ('NOT_REQUESTED', 'PENDING', 'AUTHORIZED', 'REJECTED');
CREATE TYPE promo_type_t AS ENUM ('PATRIOTIC', 'VALENTINE', 'ABANDONED_CART', 'MIN_PURCHASE', 'COUPON');
CREATE TYPE shipping_provider_code_t AS ENUM ('ANDREANI', 'CORREO_ARGENTINO', 'OCA');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role_t NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    dni_cuit VARCHAR(20),
    fiscal_address TEXT,
    tax_condition VARCHAR(50) DEFAULT 'Consumidor Final',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION trg_enforce_rbac_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    current_role user_role_t;
    super_cnt INT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.role = 'superadmin' THEN
            SELECT COUNT(*) INTO super_cnt FROM users WHERE role = 'superadmin';
            IF super_cnt >= 1 THEN
                RAISE EXCEPTION 'Violación RBAC: Solo se permite una única cuenta SuperAdmin.';
            END IF;
        END IF;
        IF NEW.role = 'admin' THEN
            IF current_setting('app.current_user_role', true) IS NULL OR current_setting('app.current_user_role', true) <> 'superadmin' THEN
                RAISE EXCEPTION 'Acceso Denegado: Registro público prohibido para rol admin. Solo SuperAdmin puede delegar.';
            END IF;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.role <> NEW.role THEN
            current_role := COALESCE(current_setting('app.current_user_role', true), 'customer')::user_role_t;
            IF current_role <> 'superadmin' THEN
                RAISE EXCEPTION 'Operación Abortada: Solo SuperAdmin puede alterar rangos.';
            END IF;
            IF NEW.role = 'superadmin' AND OLD.role <> 'superadmin' THEN
                RAISE EXCEPTION 'Operación Prohibida: Rol SuperAdmin es singular e intransferible.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_rbac_escalation
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trg_enforce_rbac_hierarchy();

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    season season_t NOT NULL DEFAULT 'Ambas',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    target_gender gender_target_t NOT NULL DEFAULT 'unisex',
    season season_t NOT NULL DEFAULT 'Ambas',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku_variant VARCHAR(120) UNIQUE NOT NULL,
    size VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    additional_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_size_color UNIQUE (product_id, size, color)
);

CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    secure_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW v_dynamic_menu AS
SELECT 
    c.id AS category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    c.season AS category_season,
    c.parent_id,
    SUM(pv.stock) AS total_stock
FROM categories c
INNER JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
INNER JOIN product_variants pv ON pv.product_id = p.id
WHERE c.is_active = TRUE
GROUP BY c.id, c.slug, c.name, c.season, c.parent_id
HAVING SUM(pv.stock) > 0;

CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255),
    status cart_status_t NOT NULL DEFAULT 'active',
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cart_owner CHECK (user_id IS NOT NULL OR session_token IS NOT NULL)
);

CREATE INDEX idx_carts_abandoned_recovery ON carts (last_activity_at) WHERE status = 'active';

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cart_item_variant UNIQUE (cart_id, product_variant_id)
);

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    promo_type promo_type_t NOT NULL,
    discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    min_purchase_amount NUMERIC(12, 2) DEFAULT 0.00,
    target_gender gender_target_t,
    target_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    independence_year INT DEFAULT 1816,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotion_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipping_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code shipping_provider_code_t UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    credentials_vault JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
    status order_status_t NOT NULL DEFAULT 'pending_payment',
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    shipping_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_total >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    shipping_address JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE RESTRICT,
    tracking_number VARCHAR(100),
    service_type VARCHAR(100) NOT NULL,
    status shipment_status_t NOT NULL DEFAULT 'draft',
    declared_value NUMERIC(12, 2) NOT NULL,
    zpl_label_base64 TEXT,
    pdf_label_url TEXT,
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_delivery TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'MERCADOPAGO',
    mp_preference_id VARCHAR(150),
    mp_payment_id VARCHAR(150) UNIQUE,
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50),
    transaction_amount NUMERIC(12, 2) NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiscal_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    is_requested_by_client BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_type invoice_type_t NOT NULL DEFAULT 'B',
    doc_type INT NOT NULL DEFAULT 96,
    doc_number VARCHAR(20) NOT NULL,
    pos_number INT NOT NULL,
    voucher_number BIGINT,
    cae VARCHAR(14),
    cae_due_date DATE,
    afip_barcode VARCHAR(100),
    arca_status arca_status_t NOT NULL DEFAULT 'NOT_REQUESTED',
    arca_raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
