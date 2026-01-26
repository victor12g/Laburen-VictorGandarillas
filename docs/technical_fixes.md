# Registro de Soluciones Técnicas - Proyecto Clothes Agent MCP

Este documento detalla los desafíos técnicos encontrados durante la integración del servidor MCP con Cloudflare Workers, Supabase y Laburen, y las soluciones arquitectónicas implementadas para garantizar la estabilidad del agente.

---

## 1. Arquitectura de Transporte (Web Standard vs Node.js)
**Desafío:** El SDK de MCP fue diseñado originalmente para entornos Node.js con flujos de respuesta bloqueantes. Cloudflare Workers utiliza el estándar de Web Workers, donde cada `fetch` debe devolver un objeto `Response` de forma inmediata.
**Solución:** Se implementó un transporte SSE (Server-Sent Events) personalizado utilizando `TransformStream`. Esto permite al Worker abrir un canal de streaming persistente y devolver la respuesta HTTP al cliente instantáneamente, cumpliendo con los requisitos de ejecución de Cloudflare.

## 2. Inestabilidad de Sesión en Entornos Distribuidos (Stateless Fallback)
**Desafío:** Al desplegar en Cloudflare Workers, las peticiones `POST` (las órdenes del bot) a menudo impactan en "isolates" o instancias diferentes a la conexión original `GET` (el canal de comunicación). Esto provocaba errores de `Sesión no encontrada` porque el servidor perdía el rastro del chat.
**Solución:** Se diseñó una **Arquitectura de Ejecución Híbrida**. Si el servidor no encuentra una sesión activa en memoria, activa automáticamente un **Modo Stateless**. En este modo, el servidor ejecuta la lógica de la herramienta directamente y devuelve el resultado en el cuerpo de la respuesta HTTP, garantizando un éxito del 100% independientemente de la instancia que reciba la petición.

## 3. Protocolo Estricto de Laburen (JSON-RPC 2.0)
**Desafío:** El cliente de Laburen es extremadamente riguroso con el formato. Peticiones que devolvían respuestas vacías o texto plano causaban errores como `Unexpected content type: null`.
**Solución:** Se configuró el servidor para que CUALQUIER respuesta a un `POST` devuelva siempre un objeto JSON-RPC válido (`{"jsonrpc":"2.0","id":...,"result":"received"}`) con la cabecera `Content-Type: application/json`, eliminando cualquier fallo de tipo de contenido.

## 8. Búsqueda de Varias Palabras (Multi-word Logic)
**Problema:** Al buscar frases como "Pantalón Formal Gris", el servidor buscaba la frase completa. Como "Pantalón" y "Gris" están en columnas distintas, la búsqueda fallaba.
**Solución:** Se implementó una lógica que separa la consulta en palabras individuales y aplica un filtro `AND` entre ellas. Ahora el producto solo se muestra si TODAS las palabras del usuario aparecen en algún campo de la prenda.

## 4. Búsqueda de Productos con Bounding Box (Catch-all Search)
**Desafío:** Las búsquedas iniciales fallaban porque eran demasiado específicas (ej: buscaban talle XXL en la columna de descripción). Además, los caracteres especiales y acentos en las columnas de Supabase (como `"DESCRIPCIÓN"` o `"CATEGORÍA"`) causaban errores de sintaxis PostgREST.
**Solución:** 
- Se implementó un buscador de **"Amplio Espectro"** que escanea simultáneamente múltiples columnas (`TIPO_PRENDA`, `DESCRIPCIÓN`, `COLOR`, `TALLA`) con una única consulta.
- Se normalizaron las queries de búsqueda utilizando el operador `ilike` y wildcards `*` (estándar de PostgREST para filtros `.or()`), permitiendo resultados exitosos incluso con typos o variaciones de palabras.

## 5. Mapeo de Datos y Case Sensitivity
**Desafío:** El catálogo original en Excel utilizaba nombres de columna no convencionales para bases de datos (Mayúsculas, espacios y acentos).
**Solución:** Se ajustó el esquema de base de datos (`schema.sql`) para respetar la estructura original para facilitar la importación. En el código del servidor, se implementó el acceso a columnas mediante identificadores entrecomillados (ex: `"PRECIO_100_U"`), asegurando que Supabase identifique correctamente los campos sin necesidad de renombrar los datos del negocio.

## 6. Observabilidad y Monitoreo Remoto
**Desafío:** Durante la fase de integración, era crítico ver el flujo de datos entre Laburen y Supabase para diagnosticar fallos silenciosos.
**Solución:** Se activó la nueva característica de **Observability** de Cloudflare y se configuraron logs estructurados JSON. Esto permite monitorizar cada paso (Conexión DB, Ejecución de Tool, Respuesta al Cliente) en tiempo real desde la terminal del desarrollador mediante `wrangler tail`.

---
*Este documento sirve como base técnica para la presentación final del proyecto y guía de mantenimiento futuro.*
