# 🧪 Test Cases - Laburen MCP Server

## 📊 Resumen
- **Total Tests:** 86 ✅ (↑ from 41 with edge cases & handover)
- **Test Files:** 6
- **Duración:** ~1.55s
- **Status:** ✅ Todo pasando

---

## 1️⃣ mcp-initialization.test.ts (20 tests)

**Qué se prueba:** Inicialización y configuración del servidor MCP

| Test | Descripción |
|------|-------------|
| debe exportar interfaz Env con propiedades requeridas | Verifica que existan SUPABASE_URL, CHATWOOT_* vars |
| debe tener versión 2.2.0 | Valida version string |
| todas las variables de env deben ser strings no vacíos | Chequea tipos y longitud |
| ruta / debe estar definida | Valida endpoint raíz |
| ruta /events debe estar definida para SSE | Valida Server-Sent Events |
| ruta /events/{sessionId} debe ser válida | Valida parametrización de rutas |
| debe extraer sessionId de query parameters | Parsea query strings |
| debe crear sesiones únicas con crypto.randomUUID | Verifica UUID generation |
| debe permitir almacenar callbacks en Map | Manejo de sesiones |
| debe permitir limpiar sesiones del Map | Cleanup de sesiones |
| debe tener switch case para todas las herramientas | Routing de tools |
| debe retornar error para herramienta desconocida | Error handling |
| debe tener try-catch en handleToolCall | Exception handling |
| debe retornar formato de error consistente | Response format validation |
| debe soportar GET para /events | HTTP methods |
| debe soportar POST para /events | HTTP methods |
| debe soportar PATCH para actualizaciones | HTTP methods |
| debe tener id en respuestas | JSON-RPC protocol |
| debe tener estructura para initialize | MCP initialization |
| debe retornar tools/list correctamente | MCP tools listing |

---

## 2️⃣ tools-schema.test.ts (12 tests)

**Qué se prueba:** Validación de schemas de herramientas MCP

| Test | Descripción |
|------|-------------|
| debe exportar un array de herramientas | TOOLS es array no vacío |
| debe contener todas las herramientas requeridas | Verifica 6 tools: list_products, create_cart, update_cart, view_cart, clear_cart, handover_to_human |
| list_products debe tener descripción y schema válido | Schema structure validation |
| list_products debe tener propiedades de filtrado opcionales | name, category, color, size params |
| create_cart debe tener schema válido | conversation_id parameter |
| update_cart debe requerir product_id y qty | Required parameters |
| update_cart debe tener alternativas de identificación | cart_id o conversation_id |
| view_cart debe aceptar cart_id o conversation_id | Parameter alternatives |
| clear_cart debe aceptar cart_id o conversation_id | Parameter alternatives |
| handover_to_human debe requerir cart_id, reason e is_purchase | Required parameters |
| handover_to_human debe tener descripción de derivación a Chatwoot | Chatwoot reference |
| cada herramienta debe tener nombre, descripción y schema | Generic validation |

---

## 3️⃣ chatwoot-integration.test.ts (7 tests)

**Qué se prueba:** Integración con Chatwoot CRM

| Test | Descripción |
|------|-------------|
| debe rechazar si faltan parámetros requeridos | cart_id + reason obligatorios |
| debe rechazar si falta cart_id | Validation error |
| debe rechazar si falta reason | Validation error |
| debe procesar derivación incluso con credenciales inválidas | Graceful fallback |
| debe convertir reason a etiqueta válida | Reason → label conversion |
| debe verificar credenciales de Chatwoot | API connectivity check |
| debe procesar derivación de conversación real | Real API integration |

---

## 5️⃣ edge-cases.test.ts (30 tests) 🆕

**Qué se prueba:** Validaciones de límites, casos extremos y edge cases

**Validación de Cantidades:**
- No permite qty = 0 ❌
- No permite qty < 0 ❌
- Permite qty > 0 ✅
- Permite qty decimal (2.5) ✅

**Validación de IDs:**
- Rechaza cart_id vacío ❌
- Rechaza product_id vacío ❌
- Acepta UUID válido ✅ (550e8400-e29b-41d4-a716-446655440000)
- Acepta product_id numérico ✅ (12345)
- Valida formato conversation_id ✅

**Validación de Strings:**
- Rechaza strings > 255 chars ❌
- Acepta strings <= 255 chars ✅
- Maneja caracteres especiales ✅ ("Pantalón azul #1 - 50%")
- Rechaza null como string ❌
- Rechaza undefined como string ❌

**Operaciones de Carrito:**
- No agregar sin ID ❌
- Permitir con cart_id ✅
- Permitir con conversation_id ✅
- Priorizar cart_id > conversation_id ✅
- No actualizar producto inexistente ❌
- No eliminar de carrito vacío ❌

**Tipos Complejos & Límites Numéricos:**
- Filtros de números válidos ✅
- Rechaza arrays como valores ❌
- Valida estructura de argumentos ✅
- Rechaza números > MAX_SAFE_INTEGER ❌
- Rango realista 1-10000 ✅
- Qty > 10000 considerada irreal ⚠️

**Casos Nulos:**
- Maneja objeto vacío {} ✅
- Valida propiedades requeridas ✅
- Permite null para opcionales ✅

---

## 6️⃣ handover-tools.test.ts (15 tests) 🆕

**Qué se prueba:** Tool de derivación y validación de handover

**handover_to_human - Schema Validation:**
| Validación | Resultado |
|-----------|-----------|
| Está definida en TOOLS | ✅ |
| Tiene descripción válida | ✅ |
| Schema tipo object | ✅ |
| Requiere: cart_id | ✅ |
| Requiere: reason | ✅ |
| Requiere: is_purchase | ✅ |
| cart_id es string | ✅ |
| reason es string | ✅ |
| is_purchase es boolean | ✅ |

**Validación de Comportamiento:**
- is_purchase=true → Compra confirmada lista para pagar ✅
- is_purchase=false → Consulta/cambios/info sin afectar stock ✅
- Acepta argumentos válidos ✅
- Es proper MCP Tool object ✅
- Tiene nombre único ✅
- Está en TOOLS array ✅

---

## 4️⃣ product-search.test.ts (2 tests)

**Qué se prueba:** Búsqueda y fuzzy matching de productos

| Test | Descripción |
|------|-------------|
| listProducts debería convertir búsqueda "pantalon" (sin tilde) a fuzzy match | Fuzzy search con acentos |
| listProducts debería manejar búsquedas sin resultados | Empty result handling |

---

## 🎯 Coverage

✅ **Funcionalidades cubiertas:**
- MCP Server initialization
- All 6 MCP tools schema validation
- Chatwoot CRM integration
- Product search (fuzzy matching)
- HTTP routing
- JSON-RPC protocol
- Error handling
- Session management

✅ **Status:** Todos los tests pasando (86/86) ✅ | **Duration:** 1.55s
