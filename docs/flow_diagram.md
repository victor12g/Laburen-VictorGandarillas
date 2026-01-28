# 🛒 Flujo de Interacción - Agente de IA Laburen

**Documento Conceptual - Máx 2 Páginas**

Este documento detalla cómo el agente de IA atiende a un cliente a través de:
1. Exploración de productos
2. Creación de carrito
3. Edición de carrito (incluye eliminación)
4. Derivación a humano para compra

---

## 📊 Diagrama de Secuencia (Flujo Principal)

```mermaid
sequenceDiagram
    participant User as 👤 Cliente
    participant Agent as 🤖 Agente IA
    participant MCP as 🔧 MCP Server<br/>(Cloudflare)
    participant Supabase as 💾 Base Datos<br/>(Supabase)
    participant Chatwoot as 💬 Chatwoot CRM

    Note over User,MCP: FASE 1: EXPLORACIÓN (SIN PRECIOS)
    User->>Agent: "¿Qué productos tienen?"
    Agent->>MCP: list_products()
    MCP->>Supabase: SELECT * FROM products
    Supabase-->>MCP: [20 productos]
    MCP-->>Agent: JSON (id, name, category, stock)
    Agent-->>User: "Tenemos 3 categorías: Remeras, Pantalones, Sudaderas"
    Note over Agent: ❌ NO muestra precios

    Note over User,MCP: FASE 2: FILTRADO (CATEGORÍA ESPECÍFICA)
    User->>Agent: "Pantalones deportivos"
    Agent->>MCP: list_products(category: "Deportivo")
    MCP->>Supabase: SELECT * FROM products WHERE category ILIKE '%deportivo%'
    Supabase-->>MCP: [5 pantalones]
    MCP-->>Agent: JSON (name, color, size, stock)
    Agent-->>User: "Tengo: Negro XL, Gris L, Azul M"
    Note over Agent: ❌ Aún NO precios

    Note over User,MCP: FASE 3: DETALLE + CARRITO + EDICIÓN
    
    User->>Agent: "El gris talle L"
    Agent->>MCP: list_products(category: "Deportivo", color: "Gris", size: "L")
    MCP->>Supabase: SELECT * FROM products WHERE...
    Supabase-->>MCP: [1 producto con precios]
    MCP-->>Agent: JSON (todas las escalas price_50_u, price_100_u, price_200_u)
    Agent-->>User: "Pantalón Gris L: $1.288/u (50-99), $1.100/u (100-199), $850/u (200+)"
    Note over Agent: ✅ PRECIOS COMPLETOS

    User->>Agent: "Agrego 150 unidades"
    Agent->>MCP: create_cart(conversation_id: "conv-123")
    MCP->>Supabase: INSERT INTO carts (id, status, total)
    Supabase-->>MCP: cart_id
    
    Agent->>MCP: update_cart(product_id, qty: 150)
    MCP->>Supabase: INSERT INTO cart_items (+ valida stock)
    Supabase-->>MCP: Success
    MCP->>Chatwoot: POST /conversations/{id}/labels<br/>label: "pantalón_gris"
    Chatwoot-->>MCP: Label agregado ✅
    MCP-->>Agent: Success
    Agent-->>User: "✅ 150 pantalones en carrito. Total: $193.800"

    User->>Agent: "Mejor borra esos, agrego 200"
    Agent->>MCP: list_products(category: "Deportivo", color: "Gris", size: "L")<br/>👈 Para obtener product_id correcto
    MCP->>Supabase: SELECT ...
    Supabase-->>MCP: product_id: "pantalón_gris_L_001"
    Agent->>MCP: update_cart(product_id: "pantalón_gris_L_001", qty: 0)<br/>👈 Elimina
    MCP->>Supabase: DELETE FROM cart_items WHERE product_id = '...'
    Supabase-->>MCP: Success
    Agent->>MCP: update_cart(product_id: "pantalón_gris_L_001", qty: 200)<br/>👈 Agrega nuevos
    MCP->>Supabase: UPSERT INTO cart_items
    Supabase-->>MCP: Success
    Agent-->>User: "✅ Actualizado a 200 unidades. Nuevo total: $258.400"

    User->>Agent: "Ver carrito"
    Agent->>MCP: view_cart(cart_id)
    MCP->>Supabase: SELECT * FROM cart_items WHERE cart_id = '...'
    Supabase-->>MCP: [items con qty, price, total]
    MCP-->>Agent: {items: [{...}], total: 258400}
    Agent-->>User: "Tu carrito: 200x Pantalón Gris L @ $1.292/u = $258.400"

    Note over User,Chatwoot: HANDOVER A HUMANO (COMPRA CONFIRMADA)
    User->>Agent: "Confirmo la compra"
    Agent->>MCP: handover_to_human(cart_id, reason: "Pago", is_purchase: true)
    MCP->>Supabase: ✓ Valida stock total disponible<br/>✓ Descuenta de inventario<br/>✓ Marca carrito como "reserved"<br/>✓ Guarda timestamp (24h expiry)
    MCP->>Chatwoot: ✓ Abre/reutiliza conversación<br/>✓ Agrega tag "pago"<br/>✓ Agrega tag "compra_confirmada"
    Chatwoot-->>MCP: Conversation ready
    MCP-->>Agent: Success
    Agent-->>User: "✅ Compra reservada por 24h. Un asesor se comunicará pronto."
```

---

## 🛠️ Endpoints MCP (Tools)

| Herramienta | Parámetros | Descripción | Cuándo se usa |
|:---|:---|:---|:---|
| **list_products** | `name?`, `category?`, `color?`, `size?` | Busca productos con filtros opcionales. Devuelve id, nombre, descripción, precios (3 escalas), stock | Exploración (Fase 1 y 2), Filtrado (Fase 2), Detalle (Fase 3), Verificación product_id antes de modificar |
| **create_cart** | `conversation_id?` | Crea nuevo carrito o reutiliza existente por conversación | Una vez por conversación, al primer "add to cart" |
| **view_cart** | `cart_id` | Devuelve items + total actualizado | Usuario pregunta "¿Cómo quedó?" o "Ver carrito" |
| **update_cart** | `cart_id`, `product_id`, `qty` | Agrega/modifica cantidades. Si qty=0, elimina. Valida stock. Agrega label a Chatwoot | Agregar productos, cambiar cantidades, eliminar items |
| **clear_cart** | `cart_id` | Vacía TODO el carrito de una vez | Usuario dice "Borrar todo" o "Reiniciar pedido" |
| **handover_to_human** | `cart_id`, `reason`, `is_purchase` | Deriva a Chatwoot. Si is_purchase=true: valida stock + descuenta + reserva 24h. Si false: consulta sin afectar stock | Compra confirmada (is_purchase=true) o consultas/cambios (is_purchase=false) |

---

## 📍 Punto Clave: Flujo de Edición de Carrito

### Eliminación Correcta
```
User: "Borra esos 150"
    ↓
Agent: 
    1. Llama list_products(filtros correctos)
       → Obtiene product_id verificado
    2. Llama update_cart(product_id, qty: 0)
       → Valida que product_id existe en cart_items
       → Si no existe: ERROR claro al usuario
       → Si existe: ELIMINA
    3. Recalcula total
    4. Responde al usuario ✅
```

### Auto-Labeling en Chatwoot
Cuando se agrega un producto:
```
Agent: update_cart(product_id, qty)
    ↓
Backend:
    1. Valida stock ✓
    2. Inserta item ✓
    3. Recalcula total ✓
    4. Si NO existe conversación en Chatwoot:
       → Crea nueva conversación automáticamente
    5. Agrega label con nombre del producto
    6. Responde al usuario ✅
```

---

## 🎯 Reglas Críticas del Agente

1. **3 Fases de Precios**
   - Fase 1: ❌ NO precios (exploración general)
   - Fase 2: ❌ NO precios (filtrado por categoría)
   - Fase 3: ✅ TODOS los precios (detalle antes de comprar)

2. **Product ID Verification**
   - ⚠️ NUNCA asumir product_id del nombre
   - ✅ SIEMPRE verificar con list_products primero
   - Si no tienes el ID → Buscar en list_products

3. **Stock Management**
   - Validar stock disponible antes de agregar
   - Mostrar cantidad máxima disponible si insuficiente
   - Después de handover=true → stock descuentado + carrito reservado 24h

4. **Cantidad Flexible**
   - Aceptar desde 1 unidad hasta 10.000+
   - NO rechazar pedidos pequeños
   - NO sugerir mínimos

5. **Derivación Inteligente**
   - `is_purchase=true` → Cliente quiere PAGAR (afecta stock)
   - `is_purchase=false` → Cliente tiene DUDAS (sin afectar stock)

---

**Versión:** 2.2.0  
**Última actualización:** 28 de enero de 2026  
**Status:** ✅ Implementado y testeado
