-- Meta integration was cancelled. Dropping its receipt table also removes
-- that table's indexes and its outgoing Lead foreign key. No CRM table changes.
BEGIN;
DROP TABLE IF EXISTS "MetaLeadReceipt";
DROP TYPE IF EXISTS "MetaReceiptStatus";
COMMIT;
