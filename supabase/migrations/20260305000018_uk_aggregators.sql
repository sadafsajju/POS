-- =============================================
-- UK aggregator platforms — Deliveroo / Uber Eats / Just Eat
--
-- Relaxes CHECK constraints on:
--   * orders.order_source     (was: pos|swiggy|zomato|kiosk|customer_app)
--   * platform_configs.platform (was: swiggy|zomato)
--
-- Indian platforms (swiggy, zomato) remain in the allowlist — existing
-- orgs keep working without change.
-- =============================================

-- ---------------------------------------------
-- orders.order_source
-- ---------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_source_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_order_source_check
    CHECK (order_source IN (
        'pos', 'kiosk', 'customer_app',
        'swiggy', 'zomato',
        'deliveroo', 'uber_eats', 'just_eat'
    ));

-- ---------------------------------------------
-- platform_configs.platform
-- ---------------------------------------------
ALTER TABLE platform_configs DROP CONSTRAINT IF EXISTS platform_configs_platform_check;

ALTER TABLE platform_configs
    ADD CONSTRAINT platform_configs_platform_check
    CHECK (platform IN (
        'swiggy', 'zomato',
        'deliveroo', 'uber_eats', 'just_eat'
    ));
