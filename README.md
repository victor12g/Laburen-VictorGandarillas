# 🛍️ Laburen - AI Sales Agent (MCP)

Agente de IA para venta mayorista de ropa integrado con **Model Context Protocol (MCP)**, **Cloudflare Workers**, **Supabase** y **Chatwoot**.

---

## 📋 Requisitos Cumplidos

| Requisito | Estado | Detalles |
|-----------|--------|----------|
| **Explorar productos** | ✅ | MCP tool `list_products` con filtros (name, category, color, size) |
| **Crear carrito** | ✅ | MCP tool `create_cart` - uno por conversación |
| **Editar carrito** | ✅ | MCP tool `update_cart` - agregar, modificar, eliminar items |
| **Ver carrito** | ✅ | MCP tool `view_cart` - items + total |
| **Derivar a humano** | ✅ | MCP tool `handover_to_human` con `is_purchase` boolean |
| **Etiquetas en CRM** | ✅ | Auto-labels al agregar productos y derivar |
| **Base de datos** | ✅ | Supabase PostgreSQL con schema.sql + 5 migrations |
| **Deployment** | ✅ | Cloudflare Workers (cron every 30 min) |
| **Chatwoot CRM** | ✅ | Integración completa + WhatsApp ready |

---

## 🚀 Quick Start

### 1. Clonar y setup
```bash
git clone https://github.com/VictorGandarillas/Laburen-VictorGandarillas.git
cd Laburen-VictorGandarillas/mcp-server
npm install
```

### 2. Configurar credenciales
```bash
# Copiar template
cp .env.example .env.local

# Llenar con tus valores y guardar en Wrangler
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put CHATWOOT_BASE_URL
wrangler secret put CHATWOOT_ACCOUNT_ID
wrangler secret put CHATWOOT_API_TOKEN
wrangler secret put CHATWOOT_INBOX_ID
wrangler secret put CHATWOOT_CONTACT_ID
wrangler secret put CHATWOOT_SOURCE_ID
```

### 3. Deploy
```bash
npm run deploy
```

---

## 📱 Probar el Agente

### Opción A: En Laburen Platform (RECOMENDADO)
1. Ir a https://dashboard.laburen.com/
2. Conectar tu MCP (URL desplegada en Cloudflare)
3. Seleccionar modelo de LLM
4. Chatear en la plataforma → Ver logs en tiempo real

### Opción B: En Chatwoot + WhatsApp (Production)
1. Enviar mensaje al número de WhatsApp
2. El agente responde directamente
3. Etiquetas se agregan automáticamente en Chatwoot
4. Mensajes se registran en el CRM

---

## 🛠️ MCP Tools

| Tool | Parámetros | Descripción |
|------|-----------|-------------|
| **list_products** | `name?`, `category?`, `color?`, `size?` | Busca productos. Devuelve id, name, description, price_50_u, price_100_u, price_200_u, stock |
| **create_cart** | `conversation_id?` | Crea carrito (1 por conversación). Si no existe, genera UUID |
| **view_cart** | `cart_id` | Devuelve items + total |
| **update_cart** | `cart_id`, `product_id`, `qty` | Agrega/modifica. Si `qty: 0`, elimina. Valida stock |
| **clear_cart** | `cart_id` | Vacía TODO el carrito |
| **handover_to_human** | `cart_id`, `reason`, `is_purchase` | Derivar a Chatwoot. Si `is_purchase: true` → valida + descuenta + reserva 24h. Si `false` → consulta sin afectar stock |

---

## 🧠 System Prompt (3 Fases)

### Fase 1: Exploración
```
User: "¿Qué productos tienen?"
Agent: list_products() → Agrupa por tipo/categoría
Respuesta: "Tenemos pantalones en 3 estilos..."
⚠️ NO muestra precios
```

### Fase 2: Filtrado
```
User: "Pantalones deportivos"
Agent: list_products(category: "Deportivo")
Respuesta: "Tenemos: Negro talle L, Gris talle XL..."
⚠️ Aún NO precios
```

### Fase 3: Detalle
```
User: "Ese gris en talle XL"
Agent: list_products(category: "Deportivo", color: "Gris", size: "XL")
Respuesta: "Pantalón XL → $1.288/u (50-99), $1.100/u (100-199), $850/u (200+)"
✅ PRECIOS COMPLETOS
```

### Carrito
```
User: "Agrego 150 unidades"
Agent: create_cart() + update_cart() → Agrega label en Chatwoot
User: "Confirmo compra"
Agent: handover_to_human(is_purchase: true) → Procesa pago + reserva 24h
```

---

## 📊 Base de Datos

### Tablas
- **products**: Catálogo (id, name, description, category, color, size, stock, price_50_u, price_100_u, price_200_u)
- **carts**: Un carrito por conversación (id, status, reserved_at, total)
- **cart_items**: Items en carrito (id, cart_id, product_id, qty, price)

### Índices
- `idx_carts_status_reserved_at` - Para cleanup de 24h

---

## 🧪 Testing

### Correr tests
```bash
npm run test
```

### Resultados
Ver [TEST_SUMMARY.md](TEST_SUMMARY.md) para detalles de cobertura y logs.

---

## ⚙️ Variables de Entorno

Todas en `wrangler.toml [env.production.vars]`:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `CHATWOOT_BASE_URL`, `CHATWOOT_ACCOUNT_ID`, `CHATWOOT_API_TOKEN`
- `CHATWOOT_INBOX_ID`, `CHATWOOT_CONTACT_ID`, `CHATWOOT_SOURCE_ID`

---

## 📅 Cron Job

Cada **30 minutos**: `cleanupExpiredReservations()`
- Busca carritos reservados > 24h
- Restaura stock
- Marca como activos

---

## 📁 Estructura

```
Laburen-VictorGandarillas/
├── mcp-server/           # MCP Server (Cloudflare)
│   ├── src/
│   │   ├── index.ts      # Entry + scheduled handler
│   │   ├── actions/      # Business logic
│   │   ├── tools/        # Tool schemas
│   │   └── lib/          # Utilities
│   └── test/
├── database/
│   ├── schema.sql
│   └── migrations/
├── docs/
│   ├── flow_diagram.md
│   └── products.xlsx
├── system_prompt_v2.md
└── INTEGRATION_GUIDE.md
```

---

## 🔗 Links

- **Laburen:** https://dashboard.laburen.com/
- **Chatwoot:** https://chatwootchallenge.laburen.com/
- **Cloudflare:** https://dash.cloudflare.com/

---

## 📄 Licencia

MIT - Proyecto challenge Laburen.com
