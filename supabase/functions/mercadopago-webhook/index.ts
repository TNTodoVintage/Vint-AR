// Mercado Pago calls this URL whenever a payment's status changes. We never
// trust the notification body itself (anyone could POST a fake one) — we
// always fetch the payment back from Mercado Pago's own API using our
// secret access token, and only act on what THAT returns.
//
// Configure this URL in Mercado Pago as the notification_url (already sent
// automatically when creating each preference in create-payment-preference).

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    // Mercado Pago sends the payment id either as ?data.id=... (webhooks v2)
    // or ?id=...&topic=payment (older IPN format).
    const paymentId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
    const topic = url.searchParams.get('type') ?? url.searchParams.get('topic');

    if (!paymentId || topic !== 'payment') {
      // Not a payment notification (could be a test ping) — acknowledge and ignore.
      return new Response('ok', { status: 200 });
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpAccessToken) {
      console.error('MP_ACCESS_TOKEN no configurado');
      return new Response('server misconfigured', { status: 500 });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });

    if (!paymentResponse.ok) {
      console.error('No se pudo obtener el pago desde Mercado Pago', await paymentResponse.text());
      return new Response('ok', { status: 200 });
    }

    const payment = await paymentResponse.json();
    const orderId = payment.external_reference;
    if (!orderId) {
      return new Response('ok', { status: 200 });
    }

    const statusMap: Record<string, string> = {
      approved: 'paid',
      rejected: 'rejected',
      cancelled: 'cancelled',
      refunded: 'rejected',
      charged_back: 'rejected',
    };
    const newStatus = statusMap[payment.status];
    if (!newStatus) {
      // pending, in_process, etc. — nothing to change yet.
      return new Response('ok', { status: 200 });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: order } = await admin
      .from('orders')
      .select('id, listing_id, buyer_id, status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return new Response('ok', { status: 200 });
    }

    // Never move an order backwards (e.g. a late "pending" notification
    // arriving after we already recorded "paid").
    if (order.status !== 'pending') {
      return new Response('ok', { status: 200 });
    }

    await admin
      .from('orders')
      .update({ status: newStatus, mp_payment_id: String(payment.id) })
      .eq('id', orderId);

    if (newStatus === 'paid') {
      await admin
        .from('listings')
        .update({ status: 'vendido', sold_to: order.buyer_id, sold_at: new Date().toISOString() })
        .eq('id', order.listing_id);
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error(error);
    // Still 200 so Mercado Pago doesn't hammer retries for a bug on our end
    // once we've logged it — but log loudly so it shows up in Supabase's
    // function logs.
    return new Response('ok', { status: 200 });
  }
});
