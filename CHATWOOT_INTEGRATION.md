# Integración Chatwoot - Estado Actual

## ✅ Lo que funciona

1. **Herramienta `handover_to_human`** está completamente integrada
2. **Tests unitarios** pasan 100% (7/7)
3. **Manejo de errores graceful** - si falla Chatwoot, el usuario igual recibe confirmación
4. **Estructura modular** - separado en `chatwoot.ts`

## ❌ Lo que falta

El token de Chatwoot retorna **401 Unauthorized**. Probablemente:
- El token tiene permisos insuficientes
- El token es de otra cuenta
- Chatwoot requiere autenticación diferente

## 🔧 Próximos pasos para resolver

### Opción 1: Usar autenticación por API Key en lugar de Token

```bash
# Probar con Authorization header
curl -X GET "https://chatwootchallenge.laburen.com/api/v1/accounts/44" \
  -H "Authorization: Bearer bffQ4etC59X39B3n73Eqtksu"
```

### Opción 2: Verificar permisos del token en Chatwoot

1. Ve a **Settings** → **API Tokens**
2. Busca el token `bffQ4etC...`
3. Verifica que tenga estos permisos:
   - ✅ Conversations: Read, Write
   - ✅ Labels: Read, Write
   - ✅ Account: Read

### Opción 3: Usar API Key de Inbox en lugar de Account

```bash
# Probar con inbox_id=35 (del curl anterior)
curl -X GET "https://chatwootchallenge.laburen.com/api/v1/accounts/44/inboxes/35" \
  -H "X-Auth-Token: bffQ4etC59X39B3n73Eqtksu"
```

## 📝 Resumen de cambios implementados

| Archivo | Cambio |
|---------|--------|
| `src/tools/index.ts` | ✅ Agregado `handover_to_human` tool |
| `src/actions/chatwoot.ts` | ✅ Implementada función completa |
| `src/index.ts` | ✅ Integrado en handler de herramientas |
| `src/actions/chatwoot.test.ts` | ✅ 7 tests (todos pasando) |

## 🚀 Cómo usar (cuando el token funcione)

```typescript
// El agente puede llamar:
await handoverToHuman(supabase, {
    conversation_id: 35,
    reason: "Cliente necesita atención especial"
}, env);

// Resultado:
// 1. Abre la conversación en Chatwoot
// 2. Añade etiquetas (handover, cliente_necesita_atencion_especial)
// 3. Retorna confirmación al usuario
```

## 💾 Variables de entorno necesarias

```env
CHATWOOT_BASE_URL=https://chatwootchallenge.laburen.com
CHATWOOT_ACCOUNT_ID=44
CHATWOOT_API_TOKEN=bffQ4etC59X39B3n73Eqtksu
CHATWOOT_INBOX_ID=50
CHATWOOT_CONTACT_ID=54
CHATWOOT_SOURCE_ID=whatsapp:+542215232385
```

---

**Status**: 🟡 Funcional pero sin conectividad real a Chatwoot (falta resolver autenticación)
