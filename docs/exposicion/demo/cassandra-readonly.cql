-- Read-only inspection for the two modeled Cassandra queries.
-- Replace every angle-bracket placeholder before running this file in cqlsh.
-- Use the UTC calendar day derived from occurred_at, for example 2026-07-20.

USE restaurant_projection;

-- Complete partition: one order timeline.
SELECT order_id, occurred_at, event_id, restaurant_id, event_type, status, total_cents
FROM order_timeline_by_order
WHERE order_id = <ORDER_UUID_V4>;

-- Complete partition: one restaurant and one UTC calendar day.
SELECT restaurant_id, day, occurred_at, event_id, order_id, event_type, status, total_cents
FROM restaurant_activity_by_day
WHERE restaurant_id = <RESTAURANT_UUID_V4>
  AND day = '<UTC_DAY_YYYY_MM_DD>';
