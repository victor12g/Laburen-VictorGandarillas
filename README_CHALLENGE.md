# Instrucciones de Despliegue: MCP Agente de Ropa

Este repositorio contiene el servidor MCP listo para desplegarse en Cloudflare Workers y conectarse con tu base de datos de Supabase.

## 1. Preparar la Base de Datos (Supabase)
1. Ve al **SQL Editor** en tu dashboard de Supabase.
2. Copia el contenido de `database/schema.sql` y ejecútalo. Esto creará las tablas `products`, `carts` y `cart_items`.
3. **Importar Productos**: 
   - Ve a la tabla `products` en el Table Editor.
   - Haz clic en **Insert** -> **Import data from CSV**.
   - Sube tu archivo `products.xlsx` (puedes guardarlo como CSV desde Excel primero).
   - Asegúrate de que las columnas coincidan con los nombres en la base de datos.

## 2. Desplegar el MCP (Cloudflare)
Desde la terminal en la carpeta `mcp-server`:

```bash
# Entrar a la carpeta
cd mcp-server

# Instalar dependencias
npm install

# Iniciar sesión en Cloudflare (si no lo has hecho)
npx wrangler login

# Desplegar
npm run deploy
```

Una vez desplegado, Cloudflare te dará una URL (ej: `https://mcp-clothes-agent.tu-usuario.workers.dev`).

## 3. Configurar en Laburen
1. Ve al panel de **Laburen**.
2. Crea un nuevo agente o edita el actual.
3. En la sección de **Herramientas/MCP**, agrega la URL de tu worker de Cloudflare seguida de `/events` (ej: `https://mcp-clothes-agent.tu-usuario.workers.dev/events`).
4. Selecciona el modelo de IA (ej: Gemini 1.5 Flash o GPT-4o).

## 4. Instrucciones para el Agente (System Prompt)
Copia esto en el prompt de tu agente en Laburen:

> Eres un asesor de ventas experto en ropa. Tu objetivo es ayudar al usuario a encontrar prendas y gestionar su carrito.
> 1. Usa `list_products` para buscar ropa cuando el usuario pregunte.
> 2. Si el usuario quiere comprar, usa `create_cart` (si no tiene uno) y luego `add_to_cart`.
> 3. Siempre confirma los detalles (talla, color) antes de agregar al carrito.
> 4. Si el usuario pide hablar con un humano o tiene un problema complejo, usa `handover_to_human`.
> 5. Mantén un tono amable y profesional (voseo argentino si es posible).
