-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_photographer_account(uuid);

CREATE FUNCTION public.get_photographer_account(_user_id uuid)
RETURNS TABLE(
  account_id uuid,
  account_type account_type,
  account_status account_status,
  is_active boolean,
  has_gestao_integration boolean,
  gallery_credits integer,
  galleries_published_total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pa.id as account_id,
    pa.account_type,
    pa.account_status,
    pa.account_status = 'active' as is_active,
    pa.account_type IN ('pro_gallery') as has_gestao_integration,
    pa.gallery_credits,
    pa.galleries_published_total
  FROM public.photographer_accounts pa
  WHERE pa.user_id = _user_id;
$$;

-- Create function to deduct credits (used when publishing)
CREATE OR REPLACE FUNCTION public.deduct_gallery_credit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credits INTEGER;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin (unlimited credits)
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  
  IF v_is_admin THEN
    -- Admins don't use credits, just increment published count
    UPDATE public.photographer_accounts
    SET galleries_published_total = galleries_published_total + 1,
        updated_at = now()
    WHERE user_id = _user_id;
    RETURN TRUE;
  END IF;
  
  -- Get current credits
  SELECT gallery_credits INTO v_current_credits
  FROM public.photographer_accounts
  WHERE user_id = _user_id;
  
  IF v_current_credits IS NULL OR v_current_credits < 1 THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credit and increment published count
  UPDATE public.photographer_accounts
  SET gallery_credits = gallery_credits - 1,
      galleries_published_total = galleries_published_total + 1,
      updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN TRUE;
END;
$$;

-- Create function to add credits (used after purchase)
CREATE OR REPLACE FUNCTION public.add_gallery_credits(_user_id uuid, _amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE public.photographer_accounts
  SET gallery_credits = gallery_credits + _amount,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING gallery_credits INTO v_new_balance;
  
  RETURN COALESCE(v_new_balance, 0);
END;
$$;