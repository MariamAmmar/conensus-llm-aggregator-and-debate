import { NextRequest, NextResponse } from 'next/server';
import { stripe, TRIAL_DAYS } from '@/lib/stripe';
import { supabase, createAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Require auth
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const origin = request.headers.get('origin') ?? 'https://consensus-ai.vercel.app';
    const admin = createAdminClient();

    // Check for existing Stripe customer ID
    const { data: existing } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = existing?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Store in Supabase
      await admin.from('user_subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'inactive',
      });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=canceled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[/api/stripe/create-checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
