-- DRAFT ONLY. Separate release gate after stage 002 and MySQL compatibility tests.
-- Confirm uq_variants_option_ram exists, all 16/29 IDs/FKs/values are preserved,
-- unknown/known matching and parent-row locking work, and ORM writes exclude
-- ram_identity_gb. Confirm every product writer uses the new identity policy.
-- This removes an old INDEX, never a table or row. No automatic down migration.
ALTER TABLE smartphone_variants DROP INDEX uq_variants_option;
