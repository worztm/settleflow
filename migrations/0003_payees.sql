-- Payees (employees, vendors, contractors, etc.) and their recurring payment plans
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Employee',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- payment_plans: one payee can have multiple plans (salary, bonus, rent, etc.)
CREATE TABLE IF NOT EXISTS payment_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'Salary',
  amount TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  -- once | daily | weekly | bi-weekly | monthly | quarterly | yearly
  frequency TEXT NOT NULL DEFAULT 'monthly',
  -- weekly -> 0-6 (0=Sunday .. 6=Saturday); monthly/quarterly/yearly -> 1-31 (day of month, clamped)
  pay_day INTEGER,
  -- date/time of the first payment; also carries the time-of-day for recurring payments
  start_date TEXT,
  next_run TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | completed
  -- optional source wallet; when null the primary wallet is used
  source_wallet_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payees_user_id ON payees(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_user_id ON payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_payee_id ON payment_plans(payee_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_next_run ON payment_plans(next_run);
