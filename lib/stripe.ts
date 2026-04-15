import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder', {
  apiVersion: '2026-03-25.dahlia',
});

export const TRIAL_DAYS = 7;
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'ammarproductions@gmail.com';
