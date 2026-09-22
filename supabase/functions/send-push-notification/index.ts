// Conectada a dos "Database Webhooks" de Supabase (Database → Webhooks),
// uno para INSERT en `messages` y otro para UPDATE en `orders`. Supabase
// llama a esta función automáticamente cuando esas filas cambian, mandando
// { type, table, record, old_record } en el body y el service_role key en
// el header Authorization — lo chequeamos para que nadie más pueda llamar
// a esta función directo y mandar notificaciones falsas a cualquier
// dispositivo.

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response('unauthorized', { status: 401 });
    }

    const payload = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);

    let recipientId: string | null = null;
    let title = '';
    let body = '';
    let data: Record<string, string> = {};

    if (payload.table === 'messages' && payload.type === 'INSERT') {
      const message = payload.record;
      const { data: conversation } = await admin
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', message.conversation_id)
        .single();
      if (!conversation) return new Response('ok', { status: 200 });

      recipientId =
        message.from_id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;

      const { data: sender } = await admin
        .from('profiles')
        .select('name')
        .eq('id', message.from_id)
        .single();

      title = sender?.name ?? 'Nuevo mensaje';
      body = String(message.text).slice(0, 140);
      data = { type: 'message', conversationId: message.conversation_id };
    } else if (payload.table === 'orders' && payload.type === 'UPDATE') {
      const order = payload.record;
      const oldOrder = payload.old_record;
      if (!oldOrder || order.status === oldOrder.status) {
        return new Response('ok', { status: 200 });
      }

      const { data: listing } = await admin
        .from('listings')
        .select('title')
        .eq('id', order.listing_id)
        .single();
      const listingTitle = listing?.title ?? 'tu publicación';

      if (order.status === 'paid') {
        recipientId = order.seller_id;
        title = '¡Vendiste un artículo!';
        body = `Te pagaron por "${listingTitle}". Envialo y esperá que el comprador confirme.`;
        data = { type: 'order', listingId: order.listing_id };
      } else if (order.status === 'confirmed') {
        recipientId = order.seller_id;
        title = 'Confirmaron la entrega';
        body = `El comprador confirmó que le llegó "${listingTitle}". Ya podés transferirle el dinero.`;
        data = { type: 'order', listingId: order.listing_id };
      } else {
        return new Response('ok', { status: 200 });
      }
    } else {
      return new Response('ok', { status: 200 });
    }

    if (!recipientId) return new Response('ok', { status: 200 });

    const { data: recipient } = await admin
      .from('profiles')
      .select('push_token')
      .eq('id', recipientId)
      .single();

    if (!recipient?.push_token) return new Response('ok', { status: 200 });

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipient.push_token,
        title,
        body,
        data,
        sound: 'default',
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('ok', { status: 200 });
  }
});
