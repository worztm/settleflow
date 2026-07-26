-- Add private_key column to wallets for storing encrypted keys
ALTER TABLE wallets ADD COLUMN private_key TEXT;