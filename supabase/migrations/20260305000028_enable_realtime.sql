-- Enable Realtime (postgres_changes) for the tables the app subscribes to.
--
-- The frontend already opens realtime channels via subscribeToOrders / subscribeToOrderItems /
-- subscribeToTables (packages/supabase/src/realtime.ts), but the `supabase_realtime` publication
-- was empty, so those subscriptions never received any events and the app fell back entirely to
-- polling. This adds the relevant tables to the publication so change events actually broadcast.
--
-- REPLICA IDENTITY FULL is required so the WAL carries every column for each change: Realtime
-- needs it to (a) deliver the full `old` record on UPDATE/DELETE and (b) evaluate the tables'
-- RLS SELECT policies against each row before delivering it to a subscribed user.

-- Add tables to the publication (idempotent — skip any already published).
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['orders', 'order_items', 'dining_tables'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- Ensure full row images are available for RLS-filtered realtime delivery.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.dining_tables REPLICA IDENTITY FULL;
