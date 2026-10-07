-- ============================================================================
-- AUDITORÍA DE SOLO LECTURA: TRANSACCIONES ASIGNADAS CON STOCK NO VENDIBLE
-- Proyecto: ESTRATOSFERA-DB (Neon PostgreSQL)
-- Descripción: Lista transacciones históricas y recientes asignadas a perfiles
--              que en el momento de la venta o en su estado actual pertenecían a
--              cuentas con fallas, en garantía, inactivas o con conflictos.
-- Ancla: Caso Esneider (cuenta ldznnfx50+og1919@gmail.com, perfiles 1188 a 1192)
-- ============================================================================

SELECT 
    t.id AS tx_id,
    t."clienteId" AS cliente_celular,
    c.nombre AS cliente_nombre,
    t."perfilId" AS perfil_id,
    sp.nombre_perfil,
    sp.estado AS perfil_estado_actual,
    ia.id AS account_id,
    ia.email AS account_email,
    ia.servicio AS account_servicio,
    ia.status AS account_status,
    ia.tipo AS account_tipo,
    t.fecha_inicio,
    t.fecha_vencimiento,
    t.monto,
    t."createdAt" AS fecha_creacion_tx,
    CASE 
        WHEN ia.email LIKE '%ldznnfx50+og1919%' OR t."perfilId" BETWEEN 1188 AND 1192
            THEN 'CASO ANCLA ESNEIDER: Cuenta ldznnfx50+og1919 (desechable vencida / perfil en garantía)'
        WHEN ia.status <> 'ACTIVE' 
            THEN 'CUENTA INACTIVA: La cuenta madre está ARCHIVED o inactiva'
        WHEN EXISTS (
            SELECT 1 FROM "SalesProfile" sp2 
            WHERE sp2."accountId" = ia.id 
              AND sp2.estado IN ('GARANTIA', 'CAIDO')
              AND sp2.id <> t."perfilId"
        ) 
            THEN 'CUENTA EN GARANTÍA: La cuenta madre tiene otros perfiles en GARANTIA/CAIDO'
        WHEN (ia.is_disposable = TRUE OR ia.tipo = 'DESECHABLE') 
         AND (ia.fecha_activacion + (ia.duracion_meses || ' month')::interval) < t.fecha_inicio 
            THEN 'DESECHABLE VENCIDA: La cuenta ya había expirado técnicamente antes de la venta'
        WHEN EXISTS (
            SELECT 1 FROM "Transaction" t2 
            WHERE t2."perfilId" = t."perfilId" 
              AND t2.id <> t.id 
              AND t2.fecha_vencimiento >= t.fecha_inicio 
              AND t2.fecha_inicio <= t.fecha_vencimiento
        ) 
            THEN 'DOBLE ASIGNACIÓN: Existía otra transacción activa simultánea sobre el mismo slot'
        ELSE 'OTRA INCONSISTENCIA DE STOCK'
    END AS motivo_auditoria
FROM "Transaction" t
INNER JOIN "Client" c ON c.celular = t."clienteId"
LEFT JOIN "SalesProfile" sp ON sp.id = t."perfilId"
LEFT JOIN "InventoryAccount" ia ON ia.id = COALESCE(sp."accountId", t."accountId")
WHERE 
    t."perfilId" IS NOT NULL
    AND (
        -- 1. Caso ancla de Esneider / cuenta 334
        ia.email LIKE '%ldznnfx50+og1919%'
        OR t."perfilId" BETWEEN 1188 AND 1192
        -- 2. Cuentas madres inactivas
        OR ia.status <> 'ACTIVE'
        -- 3. Cuentas madres con slots caídos o en garantía
        OR EXISTS (
            SELECT 1 FROM "SalesProfile" sp2 
            WHERE sp2."accountId" = ia.id 
              AND sp2.estado IN ('GARANTIA', 'CAIDO')
              AND sp2.id <> t."perfilId"
        )
        -- 4. Cuentas desechables vendidas después de su vencimiento
        OR (
            (ia.is_disposable = TRUE OR ia.tipo = 'DESECHABLE')
            AND (ia.fecha_activacion + (ia.duracion_meses || ' month')::interval) < t.fecha_inicio
        )
    )
ORDER BY t."createdAt" DESC
LIMIT 100;

-- ============================================================================
-- AUDITORÍA: PERFILES EN 'LIBRE' CON TRANSACCIONES ACTIVAS NO SUPERSEDIDAS
-- Ancla: Perfil #2400 / Tx #11786 (Fontecha - Prime Video)
-- ============================================================================
SELECT 
    sp.id AS perfil_id,
    sp.nombre_perfil,
    sp.estado AS perfil_estado,
    ia.id AS account_id,
    ia.email AS account_email,
    ia.servicio,
    t.id AS tx_id,
    t."clienteId" AS cliente_celular,
    c.nombre AS cliente_nombre,
    t.fecha_inicio,
    t.fecha_vencimiento,
    t.monto,
    t."supersededAt",
    t."supersededReason"
FROM "SalesProfile" sp
INNER JOIN "InventoryAccount" ia ON ia.id = sp."accountId"
INNER JOIN "Transaction" t ON t."perfilId" = sp.id
INNER JOIN "Client" c ON c.celular = t."clienteId"
WHERE sp.estado = 'LIBRE'
  AND t.fecha_vencimiento > NOW()
  AND t."supersededAt" IS NULL
ORDER BY sp.id ASC;

