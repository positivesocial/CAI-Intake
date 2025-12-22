-- =============================================================================
-- CAI Intake - Subscription System Migration
-- =============================================================================

-- =============================================================================
-- SUBSCRIPTION STATUS ENUM
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    );
  END IF;
END $$;

-- =============================================================================
-- PLANS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY, -- 'free', 'starter', 'professional', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Stripe integration
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  
  -- Limits (stored as JSON for flexibility)
  limits JSONB NOT NULL DEFAULT '{}',
  
  -- Display
  badge TEXT,
  highlighted BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- SUBSCRIPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  
  -- Status
  status subscription_status NOT NULL DEFAULT 'active',
  
  -- Billing period
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')) DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT subscriptions_org_unique UNIQUE(organization_id)
);

-- =============================================================================
-- USAGE RECORDS TABLE (for metered billing and tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Usage metrics
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Counters (reset each period)
  cutlists_created INTEGER DEFAULT 0,
  parts_processed INTEGER DEFAULT 0,
  ai_parses_used INTEGER DEFAULT 0,
  ocr_pages_used INTEGER DEFAULT 0,
  optimizations_run INTEGER DEFAULT 0,
  storage_used_mb DECIMAL(10, 2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT usage_org_period_unique UNIQUE(organization_id, period_start)
);

-- =============================================================================
-- PAYMENT METHODS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Stripe payment method
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'card', 'bank_account', etc.
  
  -- Card details (if applicable)
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- INVOICES TABLE (for billing history)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  
  -- Stripe invoice
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT,
  
  -- Amounts (in cents)
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER DEFAULT 0,
  amount_due_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  status TEXT NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  
  -- URLs
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  
  -- Dates
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FEATURE OVERRIDES TABLE (for custom limits per org)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feature_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  feature_key TEXT NOT NULL, -- 'maxCutlistsPerMonth', 'aiParsing', etc.
  override_value JSONB NOT NULL, -- number for limits, boolean for features
  
  reason TEXT,
  expires_at TIMESTAMPTZ,
  
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT feature_overrides_org_feature_unique UNIQUE(organization_id, feature_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_org ON public.subscription_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period ON public.subscription_usage(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON public.payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe ON public.payment_methods(stripe_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON public.invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_feature_overrides_org ON public.feature_overrides(organization_id);

-- =============================================================================
-- TRIGGERS FOR updated_at
-- =============================================================================

CREATE TRIGGER trigger_update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_subscription_usage_updated_at
BEFORE UPDATE ON public.subscription_usage
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_feature_overrides_updated_at
BEFORE UPDATE ON public.feature_overrides
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_overrides ENABLE ROW LEVEL SECURITY;

-- Plans - public read access
CREATE POLICY "Anyone can view active plans" ON public.plans
  FOR SELECT
  USING (is_active = true);

-- Subscriptions - org members can view, admins can manage
CREATE POLICY "Org members can view their subscription" ON public.subscriptions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

CREATE POLICY "Org admins can manage subscription" ON public.subscriptions
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin'))
    )
  );

-- Usage - org members can view
CREATE POLICY "Org members can view their usage" ON public.subscription_usage
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

-- Payment methods - org admins only
CREATE POLICY "Org admins can view payment methods" ON public.payment_methods
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin'))
    )
  );

CREATE POLICY "Org admins can manage payment methods" ON public.payment_methods
  FOR ALL
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin'))
    )
  );

-- Invoices - org admins can view
CREATE POLICY "Org admins can view invoices" ON public.invoices
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()::text 
        AND (u.is_super_admin = true OR r.name IN ('org_admin', 'manager'))
    )
  );

-- Feature overrides - super admins only
CREATE POLICY "Super admins can manage feature overrides" ON public.feature_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text AND u.is_super_admin = true
    )
  );

CREATE POLICY "Org members can view their feature overrides" ON public.feature_overrides
  FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

-- =============================================================================
-- SEED DEFAULT PLANS
-- =============================================================================

INSERT INTO public.plans (id, name, description, price_monthly_cents, price_yearly_cents, limits, badge, highlighted, display_order)
VALUES
  ('free', 'Free', 'Get started with basic cutlist management', 0, 0, 
   '{"maxTeamMembers": 1, "maxCutlistsPerMonth": 5, "maxPartsPerCutlist": 50, "maxStorageMb": 100, "maxAiParsesPerMonth": 10, "maxOcrPagesPerMonth": 5, "maxOptimizationsPerMonth": 3}',
   NULL, false, 1),
  ('starter', 'Starter', 'Perfect for small workshops and freelancers', 2900, 29000,
   '{"maxTeamMembers": 3, "maxCutlistsPerMonth": 50, "maxPartsPerCutlist": 200, "maxStorageMb": 1024, "maxAiParsesPerMonth": 100, "maxOcrPagesPerMonth": 50, "maxOptimizationsPerMonth": 25}',
   NULL, false, 2),
  ('professional', 'Professional', 'For growing cabinet shops and manufacturers', 7900, 79000,
   '{"maxTeamMembers": 10, "maxCutlistsPerMonth": 500, "maxPartsPerCutlist": 1000, "maxStorageMb": 10240, "maxAiParsesPerMonth": 1000, "maxOcrPagesPerMonth": 500, "maxOptimizationsPerMonth": 250}',
   'Most Popular', true, 3),
  ('enterprise', 'Enterprise', 'For large manufacturers and multi-location operations', 24900, 249000,
   '{"maxTeamMembers": -1, "maxCutlistsPerMonth": -1, "maxPartsPerCutlist": -1, "maxStorageMb": -1, "maxAiParsesPerMonth": -1, "maxOcrPagesPerMonth": -1, "maxOptimizationsPerMonth": -1}',
   NULL, false, 4)
ON CONFLICT (id) DO UPDATE SET
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  limits = EXCLUDED.limits,
  updated_at = NOW();

-- =============================================================================
-- FUNCTION: Create default subscription for new organizations
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a free subscription for new organizations
  INSERT INTO public.subscriptions (
    organization_id,
    plan_id,
    status,
    billing_interval,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'free',
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 month'
  );
  
  -- Create initial usage record
  INSERT INTO public.subscription_usage (
    organization_id,
    period_start,
    period_end
  ) VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create subscription when org is created
DROP TRIGGER IF EXISTS trigger_create_default_subscription ON public.organizations;
CREATE TRIGGER trigger_create_default_subscription
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_subscription();

-- =============================================================================
-- FUNCTION: Increment usage counter
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_usage(
  p_org_id TEXT,
  p_metric TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_current_period_start TIMESTAMPTZ;
  v_current_period_end TIMESTAMPTZ;
BEGIN
  v_current_period_start := DATE_TRUNC('month', NOW());
  v_current_period_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
  
  -- Upsert usage record
  INSERT INTO public.subscription_usage (
    organization_id,
    period_start,
    period_end
  ) VALUES (
    p_org_id,
    v_current_period_start,
    v_current_period_end
  )
  ON CONFLICT (organization_id, period_start)
  DO UPDATE SET updated_at = NOW();
  
  -- Update the specific metric
  EXECUTE format(
    'UPDATE public.subscription_usage 
     SET %I = %I + $1, updated_at = NOW()
     WHERE organization_id = $2 AND period_start = $3',
    p_metric, p_metric
  ) USING p_amount, p_org_id, v_current_period_start;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREATE SUBSCRIPTIONS FOR EXISTING ORGANIZATIONS
-- =============================================================================

INSERT INTO public.subscriptions (
  organization_id,
  plan_id,
  status,
  billing_interval,
  current_period_start,
  current_period_end
)
SELECT 
  o.id,
  'free',
  'active',
  'monthly',
  NOW(),
  NOW() + INTERVAL '1 month'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id
);

-- Create usage records for existing organizations
INSERT INTO public.subscription_usage (
  organization_id,
  period_start,
  period_end
)
SELECT 
  o.id,
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_usage u 
  WHERE u.organization_id = o.id 
    AND u.period_start = DATE_TRUNC('month', NOW())
);

-- Grant access to service role
GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.subscription_usage TO service_role;
GRANT ALL ON public.payment_methods TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.feature_overrides TO service_role;
