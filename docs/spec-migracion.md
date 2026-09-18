# Vint AR — Spec de migración a app nativa

Documento de traspaso desde el prototipo web (Claude Artifact) hacia una app real publicable en Play Store / App Store. Preparado para arrancar el proyecto en **Claude Code**.

---

## 1. Qué es Vint AR

Marketplace de ropa y objetos de segunda mano ("vintage") para Argentina — el equivalente a Vinted pero local. Ya validado como prototipo funcional con base de datos real, con las siguientes funciones probadas:

- Publicar artículos (fotos reordenables, categoría, estado, talle, precio, ubicación, descripción)
- Feed con búsqueda (título y vendedor), filtros (precio, ciudad), orden (reciente/precio)
- Favoritos, con aviso al vendedor cuando alguien favorita su artículo
- Compartir artículo por link
- Chat propio comprador–vendedor, con confirmación de lectura (✓✓)
- "Marcar como vendido" eligiendo al comprador entre quienes escribieron
- Calificaciones (1-5 estrellas + comentario) — solo habilitadas tras una venta confirmada
- Selector de ubicación (ciudad/barrio) con buscador
- Perfil con publicaciones activas, historial de ventas, y calificación recibida

## 2. Stack recomendado

| Capa | Recomendación | Por qué |
|---|---|---|
| App | **React Native con Expo** | Un solo código para iOS + Android, buen soporte en Claude Code, comunidad grande |
| Backend / base de datos | **Supabase** (Postgres + Auth + Storage + Realtime) | Gratis para empezar, auth lista para usar, storage para fotos, tiempo real para chat/favoritos, y SQL de verdad (a diferencia del prototipo) |
| Notificaciones push | Expo Notifications + Supabase Edge Functions | Para avisos de mensajes/favoritos/ventas fuera de la app |
| Mapa/ubicación real | Google Places API o Mapbox | Reemplaza la lista de ciudades escrita a mano |

Alternativa: Flutter en vez de React Native — más rápido en algunos casos, pero Claude Code tiene mejor soporte de ecosistema JS/TS.

## 3. Sistema de diseño

```
Colores:
  --paper:        #EDE6D6   (fondo)
  --paper-elevated:#F7F3E9  (tarjetas, inputs)
  --olive:        #3D4A34   (acento principal, botones primarios)
  --olive-deep:   #2C3627
  --mustard:      #C98A2B   (precios, destacados)
  --ink:          #211F1A   (texto principal)
  --ink-soft:     #6B6255   (texto secundario)
  --brick:        #A6472C   (alertas, eliminar, favoritos)
  --line:         #DCD3BE   (bordes)

Tipografía:
  Fraunces  → logo, títulos de sección (serif con carácter)
  Work Sans → todo lo demás (UI, cuerpo, precios)

Layout:
  Simulación de pantalla de celular, grilla de 2 columnas en el feed,
  chips de categoría scrolleables, botón flotante "+", barra de
  navegación inferior (Inicio / Buscar / Mensajes / Perfil).
  Bordes bien redondeados en todos lados (14-24px).
```

## 4. Modelo de datos sugerido (tablas de Supabase)

```sql
-- profiles: se crea automáticamente al registrarse (trigger sobre auth.users)
profiles (
  id uuid primary key references auth.users,
  name text,
  avatar_url text,
  location text,
  created_at timestamptz default now()
)

listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id),
  title text not null,
  price numeric not null,
  category text not null,       -- Ropa | Calzado | Accesorios | Hogar vintage
  condition text not null,      -- Nuevo con etiqueta | Muy bueno | Bueno | Con detalles
  size text,
  description text,
  location text,
  photo_urls text[],            -- URLs en Supabase Storage
  status text default 'activo', -- activo | vendido
  sold_to uuid references profiles(id),
  sold_at timestamptz,
  created_at timestamptz default now()
)

favorites (
  listing_id uuid references listings(id),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  primary key (listing_id, user_id)
)

conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  buyer_id uuid references profiles(id),
  seller_id uuid references profiles(id),
  last_message text,
  last_at timestamptz,
  buyer_unread boolean default false,
  seller_unread boolean default false,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  unique (listing_id, buyer_id)
)

messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  from_id uuid references profiles(id),
  text text not null,
  created_at timestamptz default now()
)

ratings (
  seller_id uuid references profiles(id),
  rater_id uuid references profiles(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  primary key (seller_id, rater_id)
)
```

Con Postgres real, los mensajes pueden ser filas individuales (tabla `messages`) en vez de un array dentro del documento de conversación como en el prototipo — es más prolijo y no tiene el límite de tamaño que sí tenía en el prototipo.

**Row Level Security (RLS)**: acá es donde se resuelve la privacidad real del chat que el prototipo no podía garantizar — en Supabase se configuran políticas para que una conversación solo sea legible por `buyer_id` y `seller_id`, nadie más.

## 5. Qué NO se resolvió en el prototipo (para tener en cuenta en la migración)

- **Pagos**: no hay integración de pagos ni de envíos. Para Argentina, Mercado Pago es la opción obvia a evaluar.
- **Moderación**: no hay reportar publicaciones/usuarios ni moderación de contenido.
- **"Vendido" no está verificado**: hoy lo tilda el vendedor manualmente. Con pagos reales integrados, esto se resolvería solo (se marca vendido cuando se confirma el pago).
- **Ubicación**: la lista de ciudades es manual. Con Google Places se resuelve de una.
- **Notificaciones**: solo existen como puntos dentro de la app. Hace falta push real.

## 6. Cómo arrancar en Claude Code

1. Abrí Claude Code (terminal, VS Code, o la app de escritorio).
2. Pedile que inicialice un proyecto Expo + TypeScript.
3. Pedile que configure un proyecto de Supabase con las tablas de arriba (podés pegarle este mismo bloque SQL).
4. Usá este documento como referencia de diseño y funciones — decile a Claude Code "quiero recrear esta app" y pegale las secciones 1, 3 y 4.
5. Andá función por función (arrancando por auth + feed + publicar), igual que hicimos acá.

---

*Documento generado a partir del prototipo funcional construido en Claude — todas las funciones listadas ya fueron probadas y funcionan en la versión web.*
