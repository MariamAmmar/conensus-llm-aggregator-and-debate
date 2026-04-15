import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subFields(sub: any) {
  return {
    status: sub.status as string,
    trial_end: sub.trial_end ? new Date((sub.trial_end as number) * 1000).toISOString() : null,
    current_period_end: sub.current_period_end
      ? new Date((sub.current_period_end as number) * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook] Invalid signature:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await admin.from('user_subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: sub.id,
          ...subFields(sub),
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as Record<string, string>)?.supabase_user_id;

        const query = userId
          ? admin.from('user_subscriptions').update(subFields(sub)).eq('user_id', userId)
          : admin.from('user_subscriptions').update(subFields(sub)).eq('stripe_subscription_id', sub.id);

        await query;
        break;
      }
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    // Return 200 so Stripe doesn't retry
  }

  return NextResponse.json({ received: true });
}
