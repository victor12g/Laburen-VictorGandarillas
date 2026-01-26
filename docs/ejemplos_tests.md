# Guía de Testing para MCP Server

Esta guía explica cómo implementar pruebas unitarias y de integración para este proyecto específico.

## 1. El límite de 10 productos
Efectivamente, el límite está "hardcoded" en `src/index.ts`, línea 128:
```typescript
const { data, error } = await query.limit(10);
```
**Razón:** Los LLMs tienen una "ventana de contexto" limitada. Si enviamos 500 productos, el bot puede confundirse o cortar la respuesta. 10 es un número seguro para mostrar opciones relevantes.

---

## 2. Estrategia de Testing

Para este proyecto (Cloudflare Worker + Supabase), tenemos dos enfoques:

### A. Test Unitario (Lógica Pura)
Probamos las funciones internas sin conectar a la base de datos real. "Simulamos" (Mock) la respuesta de Supabase.

**Herramientas recomendadas:** `vitest` (compatible con Workers).

**Ejemplo Conceptual:**
```typescript
// test/unit/search.test.ts
import { executeToolLogic } from '../../src/index';
// Mock de Supabase para no tocar la DB real
const mockSupabase = {
  from: () => ({
    select: () => ({
      or: () => ({
        limit: () => Promise.resolve({ 
          data: [{ name: "Pantalón Verde" }], // Simulación de respuesta
          error: null 
        })
      })
    })
  })
};

test('list_products debería encontrar pantalón', async () => {
  const result = await executeToolLogic('list_products', { query: 'verde' }, mockSupabase);
  expect(result.content[0].text).toContain('Pantalón Verde');
});
```

### B. Test de Integración (End-to-End)
Probamos el sistema completo corriendo localmente. Tu script actúa como si fuera Laburen enviando peticiones al Worker real, y este toca la DB real (o una de prueba).

**Herramientas recomendadas:** Node.js script nativo o `jest`.

**Ejemplo de Script de Integración (test-integration.js):**
Puedes crear este archivo y correrlo con `node test-integration.js` mientras tienes `npx wrangler dev` corriendo en otra terminal.

```javascript
// test-integration.js
const SERVER_URL = "http://localhost:8787/events";

async function runTest() {
  console.log("🧪 Iniciando Test de Integración...");

  // 1. Probar list_products
  const searchResp = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "list_products",
        arguments: { query: "pantalón" }
      }
    })
  });
  
  const searchResult = await searchResp.json();
  console.log("🔍 Respuesta Búsqueda:", JSON.stringify(searchResult).substring(0, 100) + "...");

  if (!searchResult.result) {
    console.error("❌ Falló la búsqueda");
    return;
  }

  // 2. Probar create_cart
  const cartResp = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "create_cart",
        arguments: {}
      }
    })
  });

  const cartResult = await cartResp.json();
  console.log("🛒 Respuesta Carrito:", cartResult);
  
  console.log("✅ Test Finalizado");
}

runTest();
```

### Resumen
- **Unitarios:** Rápidos, seguros, para validar tu lógica de `if/else` y búsqueda fuzzy.
- **Integración:** Reales, lentos, para asegurar que la conexión con Supabase y el formato JSON-RPC funcionan de verdad.
