# Vint AR

Marketplace de ropa y objetos de segunda mano para Argentina. App nativa (Expo
+ React Native) migrada desde un prototipo web funcional — ver
[`docs/spec-migracion.md`](docs/spec-migracion.md) para el spec completo
(funciones ya validadas, sistema de diseño, modelo de datos y lo que falta
resolver).

## Stack

- **App**: Expo + React Native + TypeScript, navegación con Expo Router
  (tabs: Inicio / Buscar / Mensajes / Perfil + publicar como modal).
- **Backend**: Supabase (Postgres + Auth + Storage), schema y políticas RLS
  en [`supabase/schema.sql`](supabase/schema.sql).

## Arrancar

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Corré [`supabase/schema.sql`](supabase/schema.sql) en el SQL editor del
   proyecto (tablas, triggers y políticas RLS de una sola vez).
3. Copiá `.env.example` a `.env` y completá con la URL y anon key del
   proyecto Supabase.
4. `npm install`
5. `npm run start` (o `npm run ios` / `npm run android` / `npm run web`)

## Estructura

```
app/                  rutas (Expo Router)
  (tabs)/              Inicio, Buscar, Mensajes, Perfil + botón publicar
  listing/             detalle y alta de publicación
  chat/                conversación comprador-vendedor
components/           componentes compartidos (Themed, etc.)
constants/theme.ts    tokens de diseño (colores, tipografía, radios, spacing)
lib/supabase.ts       cliente de Supabase
types/database.ts     tipos TS del schema
supabase/schema.sql   tablas, triggers y RLS
docs/spec-migracion.md  spec original de migración
```

## Estado

Scaffold inicial: navegación, sistema de diseño, cliente de Supabase y schema
con RLS ya están. Las pantallas (feed, búsqueda, publicar, chat, perfil) son
placeholders — se completan función por función arrancando por auth + feed +
publicar, según la sección 6 del spec.

Pendiente evaluar (sección 5 del spec): pagos (Mercado Pago), moderación de
contenido, ubicación real (Google Places), y push notifications.
