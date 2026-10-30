-- PostgreSQL Production Core Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    rol VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (rol IN ('user', 'admin_delegado', 'superadmin')),
    nombre VARCHAR(100),
    telefono VARCHAR(50),
    otp_hash VARCHAR(255),
    otp_expira TIMESTAMP WITH TIME ZONE,
    intentos_fallidos_otp INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE,
    token_version INT DEFAULT 1,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION proteger_superadmin_inmutable()
RETURNS TRIGGER AS $$
DECLARE
    master_email VARCHAR;
BEGIN
    master_email := current_setting('app.superadmin_email', true);
    IF OLD.email = master_email THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Operación denegada: La cuenta del SuperAdmin es inmutable y no puede eliminarse.';
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.email <> OLD.email OR NEW.rol <> 'superadmin' THEN
                RAISE EXCEPTION 'Operación denegada: No se puede modificar el correo ni degradar el rol del SuperAdmin.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_superadmin ON usuarios;
CREATE TRIGGER trg_proteger_superadmin
BEFORE UPDATE OR DELETE ON usuarios
FOR EACH ROW EXECUTE FUNCTION proteger_superadmin_inmutable();

CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    eliminado_en TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS subcategorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    eliminado_en TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE (categoria_id, slug)
);

CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    slug VARCHAR(220) UNIQUE NOT NULL,
    descripcion_copywriting TEXT NOT NULL,
    detalles_tecnicos TEXT NOT NULL,
    guia_talles JSONB NOT NULL DEFAULT '{}'::jsonb,
    categoria_id UUID NOT NULL REFERENCES categorias(id),
    subcategoria_id UUID NOT NULL REFERENCES subcategorias(id),
    genero VARCHAR(20) NOT NULL CHECK (genero IN ('Hombre', 'Mujer', 'Unisex')),
    rango_etario VARCHAR(20) NOT NULL CHECK (rango_etario IN ('Adulto', 'Adolescente', 'Niño', 'Niña', 'Todos')),
    estacion VARCHAR(15) NOT NULL CHECK (estacion IN ('Verano', 'Invierno', 'Ambas')),
    precio_base NUMERIC(12, 2) NOT NULL CHECK (precio_base >= 0),
    precio_promocional NUMERIC(12, 2) CHECK (precio_promocional >= 0 AND precio_promocional <= precio_base),
    version INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    eliminado_en TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    talle VARCHAR(20) NOT NULL,
    color VARCHAR(50) NOT NULL,
    sku VARCHAR(60) UNIQUE NOT NULL,
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    version INT DEFAULT 1,
    medidas_cm JSONB DEFAULT '{}'::jsonb,
    eliminado_en TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producto_imagenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    imagen_url TEXT NOT NULL,
    es_portada BOOLEAN DEFAULT FALSE,
    orden INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cupones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PORCENTAJE', 'MONTO_FIJO')),
    valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
    monto_minimo NUMERIC(12, 2) DEFAULT 0,
    valido_hasta TIMESTAMP WITH TIME ZONE NOT NULL,
    es_acumulable BOOLEAN DEFAULT FALSE,
    limite_usos INT,
    usos_actuales INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_cupones_activos ON cupones (LOWER(codigo)) WHERE activo = TRUE AND valido_hasta >= NOW();

CREATE TABLE IF NOT EXISTS carritos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL,
    cupon_id UUID REFERENCES cupones(id) ON DELETE SET NULL,
    session_lock_token VARCHAR(255),
    session_lock_heartbeat TIMESTAMP WITH TIME ZONE,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE carritos SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_threshold = 500,
    autovacuum_vacuum_cost_limit = 1000
);

CREATE TABLE IF NOT EXISTS carrito_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrito_id UUID NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    variante_id UUID NOT NULL REFERENCES variantes(id) ON DELETE CASCADE,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario_congelado NUMERIC(12, 2) NOT NULL,
    estacion_item VARCHAR(15) NOT NULL,
    agregado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (carrito_id, variante_id)
);

ALTER TABLE carrito_items SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_threshold = 500,
    autovacuum_vacuum_cost_limit = 1000
);

CREATE TABLE IF NOT EXISTS ordenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key UUID UNIQUE NOT NULL,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    email_contacto VARCHAR(255) NOT NULL,
    telefono_contacto VARCHAR(50),
    estado_pago VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (estado_pago IN ('PENDIENTE', 'APROBADO', 'EN_DISPUTA', 'RECHAZADO', 'CANCELADO', 'REEMBOLSADO', 'CONTRACARGO_PERDIDO')),
    subtotal_bruto NUMERIC(12, 2) NOT NULL,
    monto_descuento NUMERIC(12, 2) DEFAULT 0.00,
    costo_envio NUMERIC(12, 2) DEFAULT 0.00,
    total_neto NUMERIC(12, 2) NOT NULL,
    comision_pasarela NUMERIC(12, 2) DEFAULT 0.00,
    neto_liquidado NUMERIC(12, 2) DEFAULT 0.00,
    mercadopago_preference_id VARCHAR(100),
    mercadopago_payment_id VARCHAR(100),
    datos_envio JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_contable ON ordenes (estado_pago, creado_en) INCLUDE (total_neto, subtotal_bruto);

CREATE TABLE IF NOT EXISTS orden_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    variante_id UUID NOT NULL REFERENCES variantes(id),
    producto_nombre VARCHAR(200) NOT NULL,
    variante_info VARCHAR(100) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    estacion_item VARCHAR(15) NOT NULL,
    precio_base_original NUMERIC(12, 2) NOT NULL,
    descuento_promo_unitario NUMERIC(12, 2) DEFAULT 0.00,
    descuento_cupon_unitario NUMERIC(12, 2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS arca_comprobantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE RESTRICT,
    punto_venta INT NOT NULL,
    tipo_comprobante INT NOT NULL,
    numero_comprobante BIGINT NOT NULL,
    cuit_emisor BIGINT NOT NULL,
    doc_tipo INT NOT NULL,
    doc_nro BIGINT NOT NULL,
    cae VARCHAR(50),
    cae_vto DATE,
    importe_total NUMERIC(12, 2) NOT NULL,
    importe_neto NUMERIC(12, 2) NOT NULL,
    importe_iva NUMERIC(12, 2) NOT NULL,
    alicuotas_iva JSONB NOT NULL DEFAULT '[]'::jsonb,
    qr_data TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'AUTORIZADO', 'RECHAZADO', 'ERROR')),
    resultado_arca VARCHAR(10),
    observaciones TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (punto_venta, tipo_comprobante, numero_comprobante)
);

CREATE TABLE IF NOT EXISTS arca_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    intentos INT DEFAULT 0,
    proximo_intento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (estado IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    ultimo_error TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE arca_outbox SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_threshold = 500,
    autovacuum_vacuum_cost_limit = 1000
);

CREATE INDEX IF NOT EXISTS idx_arca_outbox_pending ON arca_outbox (creado_en ASC) WHERE estado = 'PENDING';

CREATE TABLE IF NOT EXISTS mercadopago_webhooks_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR(100) UNIQUE NOT NULL,
    request_id VARCHAR(150),
    topic VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    procesado BOOLEAN DEFAULT FALSE,
    procesado_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arca_wsaa_tokens (
    id INT PRIMARY KEY DEFAULT 1,
    service VARCHAR(20) NOT NULL,
    token TEXT NOT NULL,
    sign TEXT NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
