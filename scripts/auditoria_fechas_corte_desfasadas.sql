-- ==============================================================================
-- AUDITORÍA DE SOLO LECTURA: Transacciones con Fechas de Corte Desfasadas (Notion vs Neon)
-- App: Estratosfera (Neon DB: ESTRATOSFERA-DB)
-- Zona horaria legal de referencia: America/Bogota (UTC-5)
-- NOTA DE SEGURIDAD: Este script es 100% de SOLO LECTURA (SELECT). NO ejecuta UPDATE ni DELETE.
-- ==============================================================================

-- 1. Vista previa de los 3 casos reales anclados en el reporte:
--    - Tx 12236 / 12235: Javier Forero (Combo Disney+/Vix+, inicio 07-oct, vencimiento guardado 06-nov vs Notion 07-nov)
--    - Tx 12231 / 12230 / 12229: Arlemar Campos (Combo 3 servicios, inicio 06-oct, vencimiento guardado 05-nov vs Notion 06-nov)
--    - Tx 12234: Danilo Romero (Spotify 3 meses, inicio 08-oct, vencimiento guardado 06-ene vs Notion 08-ene)

SELECT 
    t.id AS tx_id,
    c.nombre AS cliente,
    c.celular,
    t.descripcion,
    t.monto,
    t.metodo_pago,
    t."groupId",
    -- Fecha de inicio en hora de Bogotá
    to_char(t.fecha_inicio AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS fecha_inicio_bogota,
    -- Fecha de vencimiento actual en la BD (hora Bogotá)
    to_char(t.fecha_vencimiento AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS fecha_app_actual_bogota,
    -- Fecha esperada por Notion (mismo día calendario a 1 mes)
    to_char((t.fecha_inicio AT TIME ZONE 'America/Bogota') + INTERVAL '1 month', 'YYYY-MM-DD') AS fecha_notion_esperada_1mes,
    -- Diagnóstico de desfase en días
    EXTRACT(DAY FROM ((t.fecha_vencimiento AT TIME ZONE 'America/Bogota') - ((t.fecha_inicio AT TIME ZONE 'America/Bogota') + INTERVAL '1 month'))) AS desfase_dias_aprox
FROM "Transaction" t
JOIN "Client" c ON t."clienteId" = c.celular
WHERE t.id IN (12236, 12235, 12231, 12230, 12229, 12234)
ORDER BY t.id DESC;


-- 2. Auditoría amplia: Listar transacciones de los últimos 60 días con posible desfase de fecha
--    (donde el día del mes de fecha_vencimiento no coincide con el día del mes de fecha_inicio)
SELECT 
    t.id AS tx_id,
    c.nombre AS cliente,
    c.celular,
    t.monto,
    t.descripcion,
    to_char(t.fecha_inicio AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS dia_inicio_bogota,
    to_char(t.fecha_vencimiento AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS dia_vencimiento_actual,
    EXTRACT(DAY FROM (t.fecha_inicio AT TIME ZONE 'America/Bogota')) AS dia_corte_esperado,
    EXTRACT(DAY FROM (t.fecha_vencimiento AT TIME ZONE 'America/Bogota')) AS dia_corte_actual,
    -- Cálculo de días de duración registrados
    ROUND(EXTRACT(EPOCH FROM (t.fecha_vencimiento - t.fecha_inicio)) / 86400) AS duracion_dias_registrada,
    CASE 
        WHEN ROUND(EXTRACT(EPOCH FROM (t.fecha_vencimiento - t.fecha_inicio)) / 86400) = 30 THEN 'DESFASADA: Sumó 30 días fijos en mes de 31 días (vence 1 día antes)'
        WHEN EXTRACT(DAY FROM (t.fecha_vencimiento AT TIME ZONE 'America/Bogota')) != EXTRACT(DAY FROM (t.fecha_inicio AT TIME ZONE 'America/Bogota')) THEN 'DESFASADA: Día de corte no coincide con día de inicio'
        ELSE 'CORRECTA'
    END AS estado_auditoria
FROM "Transaction" t
JOIN "Client" c ON t."clienteId" = c.celular
WHERE t.fecha_inicio >= NOW() - INTERVAL '60 days'
  AND t."supersededAt" IS NULL
  AND ROUND(EXTRACT(EPOCH FROM (t.fecha_vencimiento - t.fecha_inicio)) / 86400) = 30
ORDER BY t.fecha_inicio DESC, t.id DESC;
