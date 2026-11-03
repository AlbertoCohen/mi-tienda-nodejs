DO $$
DECLARE
    super_id UUID;
    c_calzado UUID; c_ojotas UUID; c_zapatillas UUID; c_pantalones UUID;
    c_sweaters UUID; c_cardigans UUID; c_camperitas UUID; c_camisas UUID;
    c_remeras UUID; c_chombas UUID; c_camperas UUID; c_shorts UUID;
    c_puloveres UUID; c_tapados UUID; c_pilotos UUID; c_bermudas UUID;
    c_ropa_int UUID; p_id UUID;
BEGIN
    INSERT INTO users (id, email, password_hash, role, is_active)
    VALUES (
        gen_random_uuid(),
        'itamarx2400@gmail.com',
        '$2b$12$e8YyI43q0wK7T6eYyHsmxeQ4F8Z90zY6H6q.wW9r8y4kX7xJ2EwK6',
        'superadmin',
        TRUE
    ) RETURNING id INTO super_id;

    INSERT INTO user_profiles (user_id, first_name, last_name, dni_cuit, tax_condition)
    VALUES (super_id, 'Itamar', 'SuperAdmin', '20409998881', 'Responsable Inscripto');

    INSERT INTO categories (slug, name, season) VALUES ('calzado', 'Calzado', 'Ambas') RETURNING id INTO c_calzado;
    INSERT INTO categories (slug, name, parent_id, season) VALUES ('ojotas', 'Ojotas', c_calzado, 'Verano') RETURNING id INTO c_ojotas;
    INSERT INTO categories (slug, name, parent_id, season) VALUES ('zapatillas', 'Zapatillas', c_calzado, 'Ambas') RETURNING id INTO c_zapatillas;
    INSERT INTO categories (slug, name, season) VALUES ('pantalones', 'Pantalones', 'Ambas') RETURNING id INTO c_pantalones;
    INSERT INTO categories (slug, name, season) VALUES ('sweaters', 'Sweaters', 'Invierno') RETURNING id INTO c_sweaters;
    INSERT INTO categories (slug, name, season) VALUES ('cardigans', 'Cárdigans', 'Invierno') RETURNING id INTO c_cardigans;
    INSERT INTO categories (slug, name, season) VALUES ('camperitas', 'Camperitas (Gamuza / Flecos)', 'Ambas') RETURNING id INTO c_camperitas;
    INSERT INTO categories (slug, name, season) VALUES ('camisas', 'Camisas', 'Ambas') RETURNING id INTO c_camisas;
    INSERT INTO categories (slug, name, season) VALUES ('remeras', 'Remeras', 'Verano') RETURNING id INTO c_remeras;
    INSERT INTO categories (slug, name, season) VALUES ('chombas', 'Chombas', 'Verano') RETURNING id INTO c_chombas;
    INSERT INTO categories (slug, name, season) VALUES ('camperas', 'Camperas', 'Invierno') RETURNING id INTO c_camperas;
    INSERT INTO categories (slug, name, season) VALUES ('shorts', 'Shorts (Baño / Deportivo)', 'Verano') RETURNING id INTO c_shorts;
    INSERT INTO categories (slug, name, season) VALUES ('puloveres', 'Puloveres', 'Invierno') RETURNING id INTO c_puloveres;
    INSERT INTO categories (slug, name, season) VALUES ('tapados', 'Tapados', 'Invierno') RETURNING id INTO c_tapados;
    INSERT INTO categories (slug, name, season) VALUES ('pilotos', 'Pilotos', 'Invierno') RETURNING id INTO c_pilotos;
    INSERT INTO categories (slug, name, season) VALUES ('bermudas', 'Bermudas', 'Verano') RETURNING id INTO c_bermudas;
    INSERT INTO categories (slug, name, season) VALUES ('ropa-interior', 'Ropa Interior', 'Ambas') RETURNING id INTO c_ropa_int;

    INSERT INTO products (sku, name, slug, description, base_price, category_id, target_gender, season)
    VALUES ('CMP-GAM-01', 'Camperita de Gamuza con Flecos Vintage', 'camperita-gamuza-flecos', 'Gamuza premium con flecos boho.', 85000.00, c_camperitas, 'mujer_dama', 'Ambas')
    RETURNING id INTO p_id;
    INSERT INTO product_variants (product_id, sku_variant, size, color, stock)
    VALUES (p_id, 'CMP-GAM-S', 'S', 'Camel', 10), (p_id, 'CMP-GAM-M', 'M', 'Camel', 15);

    INSERT INTO products (sku, name, slug, description, base_price, category_id, target_gender, season)
    VALUES ('CAL-OJO-02', 'Ojotas Anatómicas Summer Confort', 'ojotas-summer-confort', 'Ojotas ergonómicas ultralivianas.', 15000.00, c_ojotas, 'unisex', 'Verano')
    RETURNING id INTO p_id;
    INSERT INTO product_variants (product_id, sku_variant, size, color, stock)
    VALUES (p_id, 'OJO-41', '41/42', 'Negro', 25);

    INSERT INTO products (sku, name, slug, description, base_price, category_id, target_gender, season)
    VALUES ('TAP-INV-03', 'Tapado Largo de Paño Inglés', 'tapado-largo-pano', 'Tapado sastrero de lana.', 145000.00, c_tapados, 'mujer_dama', 'Invierno')
    RETURNING id INTO p_id;
    INSERT INTO product_variants (product_id, sku_variant, size, color, stock)
    VALUES (p_id, 'TAP-M', 'M', 'Gris', 8);

    INSERT INTO shipping_providers (code, name, credentials_vault, is_active)
    VALUES 
        ('ANDREANI', 'Andreani Logística', '{"client": "ENV_ANDREANI", "contract": "ENV_CONTRACT"}'::jsonb, TRUE),
        ('CORREO_ARGENTINO', 'Correo Argentino PAQ.AR', '{"customer": "ENV_PAQAR", "origin": "CABA"}'::jsonb, TRUE),
        ('OCA', 'OCA Express Pak', '{"account": "ENV_OCA"}'::jsonb, FALSE);

    INSERT INTO promotions (code, name, promo_type, discount_percentage, min_purchase_amount, independence_year, is_active)
    VALUES 
        ('PATRIA2026', 'Promo Fechas Patrias', 'PATRIOTIC', 25.00, 30000.00, 1816, TRUE),
        ('SANVALENTIN', 'Promo San Valentín Dama', 'VALENTINE', 20.00, 0.00, 1816, TRUE),
        ('VUELVE10', 'Recuperación Carrito Abandonado', 'ABANDONED_CART', 10.00, 10000.00, 1816, TRUE),
        ('SUPERCOMPRA', 'Descuento Compra Superior $100k', 'MIN_PURCHASE', 15.00, 100000.00, 1816, TRUE);
END $$;
