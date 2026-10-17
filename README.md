# Algase · Tienda

Tienda de confecciones, estampados y bordados. Con Supabase configurado, el catálogo, las categorías, el contacto y las solicitudes se comparten entre clientes y dispositivos. El carrito sigue siendo propio del navegador.

## Puesta en marcha

```bash
npm install
npm run dev
npm test
```

El catálogo inicial contiene productos con tallas, precios y colores. Se pueden agregar diseños desde el detalle, ubicarlos en una vista previa y guardarlos con el carrito. Las solicitudes son cotizaciones de referencia: no procesan pagos y Algase confirma disponibilidad, entrega y precio final.

## Supabase

La app usa dos variables del navegador: `VITE_SUPABASE_URL` y una sola clave pública, preferentemente `VITE_SUPABASE_PUBLISHABLE_KEY` (la clave legacy `VITE_SUPABASE_ANON_KEY` sigue aceptada). Ambas se incorporan al JavaScript público del sitio: nunca configures una `service_role`, `sb_secret_`, token de proveedor ni contraseña bajo un nombre `VITE_*`. La seguridad de los datos depende de RLS y de las funciones de servidor, no de ocultar la clave pública.

Para desarrollo local, puedes copiar `.env.example` a `.env.local` y reemplazar los valores de ejemplo, o definir las variables en el entorno antes de iniciar Vite. `.env.local` está excluido de Git. Tras cambiarlo, reinicia el servidor.

Para Netlify no necesitas subir ni copiar `.env.local`. En **Site configuration > Environment variables**, crea estas variables con scope **Builds** para cada contexto que publiques:

| Variable                        | Valor                                                |
| ------------------------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Project URL de **Supabase > Project Settings > API** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key de esa misma sección                 |

Usa `VITE_SUPABASE_ANON_KEY` solo si tu proyecto aún usa las claves legacy, y no configures ambas salvo durante una transición. Guarda los cambios y ejecuta **Clear cache and deploy site**. El build ahora valida que las variables existan en Netlify, que la URL sea HTTPS, que las claves sean públicas y que no queden valores de plantilla; si algo falta o detecta una clave privilegiada, falla con el nombre de la variable sin imprimir su valor. En desarrollo local se permite el modo sin Supabase.

En **Supabase > Authentication > URL Configuration**, configura `Site URL` con el dominio principal HTTPS de Netlify y agrega a `Redirect URLs` los destinos reales de la app, por ejemplo `https://tu-dominio.netlify.app/cuenta` y `http://localhost:5173/cuenta`. Si habilitas Deploy Previews o dominios propios, agrega también sus URLs exactas (y las reglas wildcard admitidas por Supabase si quieres cubrir previews cambiantes). Para Google OAuth, la URI de callback del proveedor sigue siendo `https://<project-ref>.supabase.co/auth/v1/callback`.

El URL y la publishable/anon key del cliente no son secretos. `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_...`, `WEBPAY_API_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y credenciales similares pertenecen exclusivamente a **Supabase Edge Function secrets**; Netlify no las necesita para compilar ni deben aparecer en variables `VITE_*`.

Puedes verificar el gate antes de publicar con `npm run test:deploy-config`. El build completo (`npm run build`) vuelve a comprobar la configuración y falla si Netlify no recibió variables válidas. Esto valida el entorno de compilación; no reemplaza aplicar migraciones, revisar RLS ni configurar redirects/proveedores externos en sus dashboards.

El archivo `netlify.toml` configura el comando de build, el directorio `dist` y el fallback SPA para rutas como `/checkout` y `/pago/retorno`. Aplica las migraciones de `supabase/migrations/` en orden en el proyecto Supabase. `0010_catalogo_inicial.sql` carga o sincroniza los ocho productos iniciales, `0011_reparar_contact_rut.sql` repara `orders.contact_rut`, `0012_profiles_rut.sql` garantiza `profiles.rut` y `0013_catalog_product_image.sql` crea `products.catalog_image_path`, inicializándolo con la imagen de detalle principal en productos existentes. El correo permanece en `auth.users`; `profiles` contiene nombre, teléfono, RUT y rol, mientras que las direcciones se guardan en `addresses`. Ejecuta `supabase/seed.sql` si necesitas cargar los datos de ejemplo del sitio.

Después de crear e iniciar sesión con la cuenta que administrará la tienda, asígnale el rol en el SQL Editor de Supabase:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
	and lower(u.email) = lower('admin@example.com');
```

La política RLS y la función `is_admin()` restringen las operaciones administrativas a ese rol. El panel `/admin` requiere una sesión remota con rol admin. Si Supabase no está configurado, la aplicación mantiene el modo local de desarrollo.

Los datos que ya estaban guardados en `localStorage` no se transfieren automáticamente al servidor; deben cargarse en el catálogo remoto antes de usarlo como fuente compartida.

## Pagos en línea

El checkout ofrece Webpay y Mercado Pago a clientes y compradores invitados cuando Supabase está configurado. Para compradores invitados, el frontend crea una sesión anónima de Supabase de forma transparente; no necesitan crear una cuenta ni iniciar sesión. Habilita **Allow anonymous sign-ins** en **Authentication > Sign In / Providers > Anonymous** en el dashboard de Supabase. Esta sesión técnica conserva la validación de propietario del pedido y permite consultar el resultado al volver del proveedor. El total y el inventario se validan en `create_checkout_order`/`create_order`; el navegador nunca decide el monto final. El pago solo se marca confirmado tras el commit de Transbank o tras validar la firma y consultar el pago directamente a Mercado Pago.

La transferencia electrónica registra una solicitud pendiente de confirmación y está disponible para clientes e invitados. Algase debe confirmar disponibilidad, despacho y monto final antes de que el cliente transfiera. Para mostrar los datos bancarios, agrega a `.env.local` `VITE_TRANSFER_BANK_NAME`, `VITE_TRANSFER_ACCOUNT_TYPE`, `VITE_TRANSFER_ACCOUNT_NUMBER`, `VITE_TRANSFER_ACCOUNT_HOLDER`, `VITE_TRANSFER_ACCOUNT_RUT` y `VITE_TRANSFER_ACCOUNT_EMAIL`. Son datos públicos visibles en el checkout; la confirmación del pago sigue siendo manual.

Antes de aceptar pagos reales:

1. Aplica `supabase/migrations/0008_payment_checkout.sql` después de las migraciones anteriores.
2. Configura los secretos en el proyecto Supabase con `supabase secrets set`: `SITE_URL`, `WEBPAY_ENV`, `WEBPAY_COMMERCE_CODE`, `WEBPAY_API_KEY`, `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`. Usa credenciales de integración/sandbox hasta terminar las pruebas. No pongas estos secretos en `.env.local` ni en el frontend.
3. Despliega las funciones `webpay-create`, `webpay-commit`, `mercadopago-create` y `mercadopago-webhook` con `supabase functions deploy <nombre>`. El archivo `supabase/config.toml` deja sin JWT solo los dos callbacks públicos; validan respectivamente el token de Transbank y la firma de Mercado Pago.
4. Registra en los paneles de Transbank y Mercado Pago las URL de retorno y webhook del proyecto Supabase, usando las rutas `/functions/v1/webpay-commit` y `/functions/v1/mercadopago-webhook` que forman las funciones. Confirma en cada panel el dominio de producción y completa primero un pago de sandbox aprobado, rechazado y cancelado.
5. Aplica `supabase/migrations/0009_transfer_requests.sql` para guardar el método de pago elegido en las solicitudes compartidas con Algase.

Para comprobar el flujo de invitado, cierra sesión, agrega un producto y selecciona WebPay o Mercado Pago. Si la opción aparece pero Supabase rechaza la creación de la sesión anónima, revisa que **Allow anonymous sign-ins** esté habilitado y que no existan restricciones CAPTCHA o de límites que bloqueen la solicitud. Las sesiones anónimas no son cuentas recuperables; el usuario debe guardar el correo de contacto y referencia del pedido.

Los proveedores, cuentas comerciales y credenciales deben estar habilitados por sus respectivos titulares. Esta integración no se considera lista para producción hasta desplegar funciones, configurar secretos y validar transacciones reales con los comercios.

## Límites importantes

- Registrar una solicitud no confirma stock, despacho ni pago. No se procesa Webpay ni Mercado Pago desde este flujo.
- Las variables públicas de Supabase no sustituyen RLS. Nunca incluyas una `service_role` key en el frontend.

## Acceso con Google

La autenticación remota se activa al configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. En el panel de Supabase, habilita Google en **Authentication > Providers**, configura el Client ID y Client Secret de Google, y permite como URLs de retorno `http://localhost:5173/cuenta` y la URL de producción terminada en `/cuenta`. En la consola de Google, registra como URI de redirección la URL callback que muestra Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`).

Sin esas variables, la tienda conserva el modo local de autenticación en el navegador; el botón de Google mostrará que falta configuración. La eliminación de cuentas remotas requiere además una función segura del lado del servidor.

Referencias de marca: `docs/brand-reference/`.
