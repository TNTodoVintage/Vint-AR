// Called by the app when a buyer taps "Comprar con Mercado Pago" on a
// listing. Creates an `orders` row and a Mercado Pago Checkout Pro
// preference, and returns the checkout URL for the app to open.
//
// Needs these secrets set on the Supabase project (Edge Functions → Manage
// secrets — see docs/pagos.md):
//   MP_ACCESS_TOKEN        Mercado Pago access token (private, server only)
//   SUPABASE_URL           already set automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY   already set automatically by Supabase

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: 'Missing listing_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({ error: 'MP_ACCESS_TOKEN no está configurado en este proyecto.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client scoped to the caller's own JWT, only to find out who they are —
    // never used to touch data other than reading their own identity.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'No se pudo identificar al usuario.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client (service role) to read the listing and write the order —
    // bypasses RLS on purpose, this function is the trusted boundary.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, title, price, seller_id, status')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Publicación no encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (listing.status !== 'activo') {
      return new Response(JSON.stringify({ error: 'Esta publicación ya no está disponible.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (listing.seller_id === user.id) {
      return new Response(JSON.stringify({ error: 'No podés comprar tu propia publicación.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cada intento le pega a la API de Mercado Pago y crea una fila nueva —
    // si alguien toca el botón repetidas veces (o intenta abusar del
    // endpoint), esto limita cuántos pedidos puede iniciar en poco tiempo.
    const { count: recentOrders } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

    if ((recentOrders ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: 'Estás iniciando muchos pagos muy rápido. Esperá un minuto e intentá de nuevo.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: listing.price,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'No se pudo crear el pedido.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: listing.title,
            quantity: 1,
            unit_price: Number(listing.price),
            currency_id: 'ARS',
          },
        ],
        external_reference: order.id,
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
        back_urls: {
          success: `vintar://payment-result?order_id=${order.id}&status=success`,
          failure: `vintar://payment-result?order_id=${order.id}&status=failure`,
          pending: `vintar://payment-result?order_id=${order.id}&status=pending`,
        },
        auto_return: 'approved',
      }),
    });

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text();
      console.error('Mercado Pago error:', errorBody);
      return new Response(
        JSON.stringify({ error: 'Mercado Pago rechazó la solicitud de pago.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preference = await mpResponse.json();

    await admin.from('orders').update({ mp_preference_id: preference.id }).eq('id', order.id);

    return new Response(
      JSON.stringify({ checkout_url: preference.init_point, order_id: order.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Error inesperado.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
