-- ============================================================================
-- AUDITORÍA DE SOLO LECTURA: TRANSACCIONES CON MONTO $0 O NULL (ÚLTIMOS 60 DÍAS)
-- Proyecto: ESTRATOSFERA-DB (Neon PostgreSQL)
-- Descripción: Lista transacciones con monto = 0 o NULL para revisión manual de
--              contabilidad (Kerwin / balances de /sales / Analytics).
-- Anclas: Mr Nuñez (Tx #11881), Karencita (Tx #12091)
-- ============================================================================

SELECT 
    t.id AS tx_id,
    t."clienteId" AS cliente_celular,
    c.nombre AS cliente_nombre,
    t.monto,
    t.metodo_pago,
    t.descripcion,
    t."groupId",
    t.fecha_inicio,
    t.fecha_vencimiento,
    t."createdAt" AS fecha_creacion_tx,
    t."supersededAt",
    t."supersededReason",
    sp.id AS perfil_id,
    sp.nombre_perfil,
    sp.estado AS perfil_estado,
    ia.id AS account_id,
    ia.servicio,
    ia.email AS account_email,
    CASE 
        WHEN t.id = 11881 THEN 'CASO ANCLA: Mr Nuñez (Tx #11881 - Asignación / combo $0)'
        WHEN t.id = 12091 THEN 'CASO ANCLA: Karencita (Tx #12091 - Asignación manual $0)'
        WHEN t.monto = 0 AND t.metodo_pago IS NULL AND t.descripcion IS NULL 
            THEN 'VENTA FANTASMA: Creada por "Asignar Manualmente" sin monto ni método de pago'
        WHEN t.monto = 0 AND t."groupId" IS NOT NULL 
            THEN 'COMBO CON LÍNEA EN $0: Creada o modificada con reparto de monto en cero'
        WHEN t.monto = 0 
            THEN 'TRANSACCIÓN EN $0: Creada manualmente sin valor comercial registrado'
        ELSE 'OTRA INCONSISTENCIA DE MONTO'
    END AS clasificacion_auditoria
FROM "Transaction" t
LEFT JOIN "Client" c ON c.celular = t."clienteId"
LEFT JOIN "SalesProfile" sp ON sp.id = t."perfilId"
LEFT JOIN "InventoryAccount" ia ON ia.id = COALESCE(sp."accountId", t."accountId")
WHERE 
    (
        t.monto = 0 
        OR t.monto IS NULL 
        OR t.id IN (11881, 12091)
    )
    AND (
        t."createdAt" >= NOW() - INTERVAL '60 days'
        OR t.id IN (11881, 12091)
    )
ORDER BY t.id DESC;
