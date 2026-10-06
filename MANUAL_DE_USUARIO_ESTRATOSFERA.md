# MANUAL DE USUARIO Y GUÍA OPERATIVA MAESTRA
## Plataforma Estratosfera — Sistema de Gestión de Streaming, Clientes y Finanzas

---

## ÍNDICE GENERAL
1. **Introducción y Filosofía del Sistema**
2. **Estructura y Navegación de la Aplicación**
3. **Módulo 1: Inventario de Cuentas y Perfiles (`/inventory`)**
   - 3.1. Cuentas Madres vs. Perfiles/Slots
   - 3.2. Cuentas Renovables vs. Cuentas Desechables
   - 3.3. Creación de una Cuenta Madre y Proveedor (Paso a Paso)
   - 3.4. Estados de un Perfil (`LIBRE`, `OCUPADO`, `CUARENTENA_PIN`, `GARANTIA`, `CAIDO`)
   - 3.5. Explicación de Cada Botón y Acción en Inventario
4. **Módulo 2: Flujo Completo de Ventas (`/sales`)**
   - 4.1. Venta Simple de Perfil
   - 4.2. Venta de Cuenta Completa
   - 4.3. Venta de Combo (2, 3 o 4 Servicios)
   - 4.4. Venta Libre (Sin Perfil Asociado)
   - 4.5. Facturación y Generación de Comprobantes
   - 4.6. El Botón Crítico: "Copiar Mensaje al Cliente (WhatsApp)"
5. **Módulo 3: Gestión de Clientes, Ciclos y Duplicados (`/clients`)**
   - 5.1. Identidad de Cliente: Celular vs. `@usuario` de WhatsApp
   - 5.2. Semáforo de Vencimientos (Urgente, Alerta, Normal, Renovado)
   - 5.3. Menú de Acciones por Cliente (Renovar, Garantía, Migrar, Rotar PIN, Liberar)
   - 5.4. Pestaña de Auditoría (Acciones Prioritarias de Corte y Cobro)
   - 5.5. Pestaña de Unificación / Fusión de Clientes Duplicados
6. **Módulo 4: Administración, Cobranzas del Día y Proveedores (`/administracion`)**
   - 6.1. Señal de Cobro y Ciclo Derivado (`VIGENTE`, `POR_VENCER`, `VENCIDO`)
   - 6.2. Lista "Cobros del Día" (Zona Horaria Bogotá UTC-5)
   - 6.3. Disparo Masivo de Recordatorios (Bot Automático)
   - 6.4. Vencimientos de Cuentas con Proveedores (Ayer, Hoy, Mañana, Próximos)
   - 6.5. Control y Pago de Nómina del Equipo
7. **Módulo 5: Egresos y Control Financiero**
   - 7.1. Registro de Gastos y Categorías
   - 7.2. Balance General (Ingresos - Egresos = Utilidad Neta)
8. **Módulo 6: Portal de Autoservicio del Cliente (`/portal`)**
   - 8.1. Acceso vía Celular y Magic Link
   - 8.2. Lo que ve el Cliente (Credenciales, Vencimientos y Soporte)
9. **Protocolo Operativo Estándar (SOP) para Agentes**
   - 9.1. Procedimiento para Vender un Servicio
   - 9.2. Procedimiento para Renovar un Servicio
   - 9.3. Procedimiento para Dar Garantía (Cambio por Caída o Falla)
   - 9.4. Procedimiento para Dar de Baja / No Renovar (Liberación de Slot con PIN)
   - 9.5. Errores Críticos que Deben Evitarse

---

## 1. INTRODUCCIÓN Y FILOSOFÍA DEL SISTEMA

La aplicación **Estratosfera** es una solución integral diseñada para automatizar y ordenar el ciclo de vida de los servicios de streaming y entretenimiento:
- **Separación estricta entre Cuentas Madres y Perfiles:** Una cuenta de proveedor (ej. Netflix 5 pantallas) contiene slots individuales que se comercializan a clientes finales.
- **Identidad de Contacto Flexible:** Soporta tanto números telefónicos tradicionales (+57...) como nombres de usuario de WhatsApp (`@usuario`), eliminando caracteres invisibles y duplicidades.
- **Trazabilidad Financiera:** Cada movimiento genera una transacción que alimenta ingresos, gastos, nómina y alertas de cobranza.
- **Garantías Ágiles:** Reemplazo de perfiles caídos manteniendo la fecha de corte original del cliente sin descuadrar la caja.

---

## 2. ESTRUCTURA Y NAVEGACIÓN DE LA APLICACIÓN

La barra de navegación principal (y menú móvil inferior) se divide en 5 grandes áreas operativas:

| Módulo | Ruta | Propósito Principal |
| :--- | :--- | :--- |
| **Ventas** | `/sales` | Registro de ingresos y gastos diarios, historial de facturación, descarga de recibos y copia de mensajes oficiales de entrega. |
| **Clientes** | `/clients` | Fichas de clientes, días restantes de cada servicio, renovación, garantías, auditoría de cortes y fusión de duplicados. |
| **Inventario** | `/inventory` | Cuentas matrices de proveedores, perfiles libres/ocupados, rotación técnica de PINs/claves y armado de combos. |
| **Administración**| `/administracion` | Centro de cobranzas ("Cobros del Día"), pagos pendientes a proveedores, acumulado de nómina y métricas de salud financiera. |
| **Analytics** | `/analytics` | Reportes gráficos de rendimiento anual, servicios más vendidos, tasa de retención y métricas de crecimiento. |
| **Portal Cliente**| `/portal` | Espacio web de autoservicio donde el cliente final consulta sus credenciales y fechas de corte sin saturar al agente. |

---

## 3. MÓDULO 1: INVENTARIO DE CUENTAS Y PERFILES (`/inventory`)

El inventario es el corazón técnico del negocio. Aquí se cargan los accesos comprados a proveedores mayoristas antes de ser entregados a los clientes.

### 3.1. Cuentas Madres vs. Perfiles/Slots
- **Cuenta Madre:** Es la cuenta principal de streaming (correo electrónico + contraseña maestra) adquirida a un proveedor (ej. `proveedor1_nfx@gmail.com`).
- **Perfil o Slot:** Es cada uno de los espacios que la cuenta permite crear (ej. Perfil 1, Perfil 2, Perfil 3, Perfil 4, Perfil 5). Cada perfil tiene su propio nombre y PIN de bloqueo de 4 dígitos.

### 3.2. Cuentas Renovables vs. Cuentas Desechables
- **Renovable:** Cuenta que se paga mes a mes al proveedor para conservarla activa indefinidamente. Los perfiles son estables y los clientes pueden renovar en el mismo perfil sin cambiar de correo.
- **Desechable (Mes a mes):** Cuenta temporal que muere al cabo de 30 días. Al terminar el ciclo, no se renueva al proveedor; los clientes deben ser migrados a una cuenta nueva.

### 3.3. Creación de una Cuenta Madre (Paso a Paso)
1. Entrar a `/inventory` y hacer clic en el botón superior derecho **`+ Agregar Cuenta`**.
2. **Servicio:** Seleccionar del desplegable (Netflix, Disney+, Max, Prime Video, Spotify, YouTube, etc.) o activar "Servicio Personalizado".
3. **Correo y Contraseña:** Ingresar las credenciales exactas entregadas por el proveedor.
4. **Proveedor:** Seleccionar el proveedor existente o escribir uno nuevo para crear la ficha.
5. **Cantidad de Perfiles:** Indicar cuántos slots activos tiene la cuenta (ej. 5 perfiles para Netflix).
6. **Configuración de PINs:** Activar "Usar PINs" y definir el PIN de cada perfil (o generarlo automáticamente).
7. **Tipo de Cuenta:** Marcar si es *Desechable* o *Renovable*.
8. **Día de Corte / Fecha de Activación:** Ingresar cuándo vence la cuenta con el proveedor.
9. Pulsar **`Guardar Cuenta`**. Los perfiles quedarán creados en estado `LIBRE`.

### 3.4. Estados de un Perfil
- 🟢 **`LIBRE`:** Perfil disponible en stock listo para ser vendido o usado como garantía.
- 🔴 **`OCUPADO`:** Perfil asignado a un cliente activo con venta vigente. Muestra el nombre y celular del cliente.
- 🟡 **`CUARENTENA_PIN`:** Perfil cuyo PIN fue reportado como cambiado o en revisión técnica.
- 🟠 **`GARANTIA`:** Perfil apartado temporalmente para solucionar un reclamo técnico.
- ⚫ **`CAIDO`:** Cuenta completa o perfil suspendido por el proveedor. Requiere reemplazo o reactivación.

### 3.5. Botones y Acciones en Inventario
- **`Vender` (en tarjeta de perfil):** Abre el modal de venta inmediata asignando ese slot exacto al cliente.
- **`Vender Cuenta Completa` (en tarjeta de cuenta):** Vende todos los perfiles de la cuenta a un solo cliente (aplica para clientes corporativos o familias que compran la cuenta entera).
- **`Modo Combo` (botón superior):** Permite activar casillas de verificación para seleccionar 2, 3 o 4 perfiles de distintas cuentas y venderlos en un solo paquete consolidado.
- **`Garantía / Revivir`:** En perfiles con problemas, intercambia el perfil por otro libre del mismo servicio manteniendo el mismo PIN y la fecha del cliente.
- **`Rotar Contraseña / PIN`:** Modifica la contraseña o el PIN en el sistema cuando el proveedor o el agente hace un cambio técnico.
- **`Archivar`:** Oculta cuentas desechables vencidas para mantener limpia la vista de trabajo diario sin perder el histórico.

---

## 4. MÓDULO 2: FLUJO COMPLETO DE VENTAS (`/sales`)

En `/sales` se controlan todas las entradas de dinero y la emisión de credenciales oficiales.

### 4.1. Venta Simple de Perfil (Flujo Estándar)
1. Hacer clic en **`Nueva Venta`** (botón verde superior o flotante en móvil).
2. **Cliente:** Escribir el número de celular (ej. `+573145071762`) o su usuario de WhatsApp (ej. `@maryp0404`). Si el cliente ya existe, el autocompletado sugerirá su ficha.
3. **Nombre del Cliente:** Confirmar o actualizar el nombre real.
4. **Producto / Servicio:** Seleccionar del inventario disponible el perfil que se va a asignar (ej. *Netflix - Perfil 3*).
5. **Monto:** El sistema precarga el precio sugerido según el servicio. Puede editarse si hubo descuento o promoción.
6. **Método de Pago:** Seleccionar Nequi, Bancolombia, Daviplata, Efectivo o USDT.
7. **Duración:** Definir los meses adquiridos (1, 2, 3, etc.). El sistema calcula la fecha de vencimiento con protección fin de mes (ej. 31 de enero + 1 mes = 28 de febrero).
8. Hacer clic en **`Confirmar Venta`**.
9. El perfil pasa inmediatamente a `OCUPADO` en Inventario y la venta queda registrada en Ingresos.

### 4.2. Venta de Cuenta Completa
- Se utiliza cuando el cliente compra la cuenta madre entera (todas las pantallas).
- Se ejecuta directamente desde el botón **`Vender Cuenta Completa`** en `/inventory` o seleccionando la cuenta en el modal de ventas.
- El mensaje generado entrega el correo y contraseña maestro indicando las reglas de no modificar correos ni contraseñas principales.

### 4.3. Venta Combo (2 a 4 Servicios)
1. En `/inventory`, hacer clic en **`Activar Modo Combo`**.
2. Marcar las casillas de los perfiles que integrarán el combo (ej. 1 perfil de Netflix + 1 perfil de Disney+ + 1 perfil de Max).
3. Hacer clic en **`Vender Combo Seleccionado`**.
4. Ingresar el cliente, método de pago, monto total del combo y duración.
5. El sistema vincula las transacciones bajo un identificador común (`groupId`).
6. Al finalizar, genera un **mensaje unificado** que incluye los correos, perfiles, PINs y la nota de inicio de sesión de Netflix en un solo texto limpio.

### 4.4. Venta Libre (Sin Perfil Asociado)
- Si se vende un servicio externo que no se administra dentro del inventario local (ej. recargas, IPTV externo, licencias de software), se selecciona la opción *"Venta Libre"*.
- Suma al balance financiero sin descontar perfiles del inventario.

### 4.5. Facturación y Comprobantes de Pago
- En la lista de ingresos, cada venta tiene un botón con ícono de flecha hacia abajo **`Descargar Factura`**.
- Al pulsarlo, el sistema genera una imagen PNG profesional de comprobante con los logos de Estratosfera, fecha, monto, servicio y método de pago.
- En dispositivos móviles, activa la opción nativa de **Compartir por WhatsApp** directamente.

### 4.6. El Botón Crítico: "Copiar Mensaje al Cliente (WhatsApp)"
> [!IMPORTANT]
> **Regla de Oro Operativa:** Ningún agente debe redactar mensajes de entrega manualmente. Siempre debe usarse la plantilla oficial generada por la app.

- **Dónde está el botón:** En la lista de `/sales`, al lado derecho de cada venta de ingreso, verás el ícono violeta de dos hojas **`Copiar`**.
- **En el detalle:** Si tocas la fila de la venta para abrir el modal de edición, encontrarás el botón ancho: **`Copiar mensaje al cliente (WhatsApp)`**.
- **Qué contiene el mensaje copiado al portapapeles:**
  - Saludo personalizado con el nombre del cliente.
  - Servicio contratado y fecha de corte exacta.
  - Correo electrónico y contraseña del servicio.
  - Perfil asignado y PIN de 4 dígitos (si aplica).
  - *Nota especial de Netflix:* Instrucciones para dar clic en "Obtener ayuda" -> "Usar contraseña" si la TV pide código de confirmación temporal.
  - Advertencias claras de garantía (no modificar correo, no borrar perfiles, no abrir en más pantallas de las contratadas).

---

## 5. MÓDULO 3: GESTIÓN DE CLIENTES, CICLOS Y DUPLICADOS (`/clients`)

En `/clients` se administra la cartera de compradores, su fidelidad y su historial de renovaciones.

### 5.1. Identidad de Cliente: Celular vs. `@usuario` de WhatsApp
- Los clientes pueden registrarse con su número telefónico (ej. `+57 314 5071762`) o con su usuario de WhatsApp (ej. `@maryp0404`).
- El sistema cuenta con un filtro automático que elimina caracteres invisibles Unicode (`\u2066`, `\u2069`) que suelen pegarse desde WhatsApp Web y que rompían los enlaces directos de chat.
- Al pulsar el botón de WhatsApp, el sistema abre directamente la conversación con la persona sin importar si es número o `@handle`.

### 5.2. Semáforo de Vencimientos
Cada tarjeta de cliente tiene un indicador visual del estado de su servicio:
- 🟢 **Verde (`Normal`):** Faltan más de 3 días para su fecha de corte. El cliente está al día.
- 🟡 **Amarillo (`Alerta`):** Faltan entre 1 y 3 días para vencer. Momento ideal para enviar recordatorio preventivo.
- 🔴 **Rojo (`Urgente / Vencido`):** Vence hoy (0 días) o tiene días negativos (vencido sin pagar). Requiere cobro o corte.
- 🔵 **Azul (`Renovado`):** El cliente ya pagó su ciclo siguiente por adelantado.

### 5.3. Menú de Acciones por Cliente (Botón `...`)
Al tocar los tres puntos en cualquier cliente, se despliegan las siguientes opciones:

1. **`Enviar Recordatorio` (Ícono Chat):** Abre WhatsApp con el mensaje preformateado indicando los días restantes, el monto y los métodos de pago (Nequi, Bancolombia, Bre-B, Nu Bank, PayPal).
2. **`Renovar Servicio` (Ícono Check):**
   - Registra el nuevo pago del cliente.
   - Extiende la fecha de corte 1, 3, 6 o 12 meses.
   - Genera el ingreso financiero correspondiente.
3. **`Corregir Vencimiento` (Ícono Lápiz junto a los días):**
   - Permite ajustar la fecha de corte cuando hubo un error de digitación sin crear un pago nuevo ni alterar la caja.
4. **`Reenviar Datos`:** Copia o envía nuevamente las credenciales oficiales de la cuenta.
5. **`Garantía (Auto)`:** Busca automáticamente en Inventario otro perfil libre del mismo servicio y lo asigna al cliente conservando su fecha de corte original.
6. **`Migrar (Manual)`:** Permite elegir manualmente una cuenta o perfil específico de reemplazo.
7. **`Pass / PIN`:** Envía al cliente una plantilla técnica cuando se cambió la clave o el PIN del perfil.
8. **`Cambiar Plan / Upgrade`:** Pasa al cliente a un servicio superior (ej. de Max a Combo) y permite liberar el perfil anterior.
9. **`Liberar Perfil` (Ícono X roja):**
   - Se usa cuando el cliente **NO** renueva.
   - **Exigencia del sistema:** Solicita obligatoriamente ingresar un **NUEVO PIN** para el perfil liberado en inventario. Esto garantiza que el cliente saliente no pueda seguir usando el servicio.
10. **`Fusionar / Unificar`:** Abre el asistente para unir este cliente con otra ficha duplicada.

### 5.4. Pestaña de Auditoría (Acciones Prioritarias)
- Ubicada en la parte superior de `/clients`.
- Muestra el cruce entre la **Fecha Técnica** (cuándo vence la cuenta con el proveedor) y la **Fecha de Cobro** (cuándo vence el pago del cliente).
- Identifica dos tipos de alertas críticas:
  - 🔴 **`CORTAR / DEFICIT TECNICO`:** La cuenta del proveedor vence antes que el mes del cliente. Requiere cambio técnico urgente para que el cliente no se quede sin señal.
  - 🟢 **`COBRAR`:** El ciclo del cliente vence en los próximos 3 días.

### 5.5. Pestaña de Unificación / Fusión de Clientes Duplicados
- **El problema histórico:** Clientes que antes pagaban con celular (ej. Mary Pérez con `+57 314 5071762`) y luego pasaron a escribir desde `@maryp0404`. Se creaban 2 fichas separadas y el historial quedaba partido.
- **La solución atómica:**
  1. Entrar a la pestaña **`Unificar / Duplicados`**.
  2. El sistema detecta automáticamente clientes con nombres similares que tienen múltiples números o handles.
  3. Al seleccionar cuál se conserva como Principal (ej. `@maryp0404`) y cuál se absorbe (ej. el celular viejo), el sistema traslada el **100% de las ventas pasadas, servicios y notas** a la ficha principal y borra de forma segura la ficha secundaria.
  4. También se puede usar el botón **`Fusión Manual`** para buscar y unir cualquier par de clientes en cualquier momento.

---

## 6. MÓDULO 4: ADMINISTRACIÓN, COBRANZAS DEL DÍA Y PROVEEDORES (`/administracion`)

Este módulo está destinado a la supervisión operativa del negocio y la liquidación de cuentas.

### 6.1. Señal de Cobro y Ciclo Derivado
- Históricamente, el campo `estado_pago` decía `PAGADO` en casi todas las ventas porque el cliente pagó al inicio de su mes. Esto impedía saber quién debía hoy.
- Ahora el sistema calcula el **Estado Derivado de Ciclo**:
  - **`VIGENTE`:** La fecha de vencimiento es mayor a hoy (fin de día Bogotá).
  - **`POR_VENCER`:** Faltan entre 1 y 3 días.
  - **`VENCIDO / POR COBRAR`:** La fecha de vencimiento ya pasó y el cliente no tiene una venta de renovación posterior.

### 6.2. Lista "Cobros del Día"
- En `/administracion`, filtra automáticamente todas las ventas cuyo vencimiento ocurre en el día actual (o están vencidas sin renovar).
- Permite contactar rápidamente a los clientes en mora sin tener que revisar uno por uno en la lista general.

### 6.3. Disparo Masivo de Recordatorios (Bot Automático)
- Botón **`Disparar Recordatorios Bot`** en la cabecera.
- Envía automáticamente a través de la API de mensajería el recordatorio oficial a todos los clientes que tengan entre 0 y 2 días restantes para vencer.

### 6.4. Vencimientos de Cuentas con Proveedores
- Agrupa las cuentas madres que deben pagarse al mayorista en cuatro bloques:
  - 🔴 **`AYER`:** Cuentas vencidas que requieren pago o cancelación inmediata.
  - 🟡 **`HOY`:** Cuentas que vencen hoy con el proveedor.
  - 🔵 **`MAÑANA`:** Cuentas que vencen el día siguiente.
  - ⚪ **`PRÓXIMOS`:** Vencimientos de la semana.
- Cada tarjeta permite:
  - Ver el proveedor, correo de la cuenta y cantidad de perfiles ocupados por clientes.
  - Marcar como pagada creando automáticamente el gasto a proveedor.
  - Ocultar del listado temporalmente.

### 6.5. Control y Pago de Nómina
- El sistema acumula diariamente el valor pactado de nómina según los días trabajados.
- Botón **`Pagar Nómina`**: Solicita confirmar el monto pagado, registra el egreso contable en la categoría `NOMINA` y reinicia el contador de días para el siguiente periodo.

---

## 7. MÓDULO 5: EGRESOS Y CONTROL FINANCIERO

Para que el balance de caja sea exacto, ningún gasto debe quedar por fuera.

### 7.1. Registro de Gastos (`/sales` -> Pestaña Egresos)
1. Hacer clic en **`Nuevo Gasto`** (botón rojo).
2. **Categoría:**
   - `PROVEEDOR`: Pago de cuentas madres a mayoristas. Permite seleccionar el proveedor de la lista.
   - `NOMINA`: Pagos a colaboradores o agentes.
   - `GASTO_ADMIN`: Herramientas de software, servidores, hosting, etc.
   - `PUBLICIDAD`: Pauta digital, anuncios o promociones.
   - `OTRO`: Gastos varios no clasificados.
3. **Monto y Método:** Ingresar la cifra exacta y la vía de pago.
4. **Fecha y Descripción:** Detallar el concepto del gasto.

### 7.2. Balance Financiero
En la parte superior de `/sales` y en `/administracion`:
$$\text{Balance Total} = \text{Total Ingresos} - \text{Total Egresos}$$
Permite evaluar la rentabilidad real del negocio filtrando por día, semana, mes o año.

---

## 8. MÓDULO 6: PORTAL DE AUTOSERVICIO DEL CLIENTE (`/portal`)

El portal reduce hasta un 70% las preguntas repetitivas de soporte por WhatsApp (*"¿Cuál era mi clave?", "¿Cuándo se me vence?", "¿Qué perfil me tocó?"*).

### 8.1. Cómo Accede el Cliente
- El cliente entra a `https://tu-dominio.com/portal`.
- Escribe su celular o `@usuario`.
- El sistema le permite ingresar mediante código OTP temporal o mediante su **Magic Link** único generado por el bot.

### 8.2. Qué Puede Ver el Cliente
- Lista de todos sus servicios contratados activos.
- Correo y contraseña actualizados de cada plataforma.
- Nombre de su perfil y PIN asignado.
- Contador regresivo de días restantes para su fecha de corte.
- Botón directo para solicitar renovación o soporte por WhatsApp.

---

## 9. PROTOCOLO OPERATIVO ESTÁNDAR (SOP) PARA AGENTES

Guía rápida paso a paso que todo agente nuevo o en turno debe seguir rigurosamente:

### 9.1. Procedimiento para Vender un Servicio
1. Verificar disponibilidad en `/inventory`.
2. Si el perfil está en verde (`LIBRE`), hacer clic en **`Vender`**.
3. Ingresar el contacto del cliente asegurándose de no dejar espacios raros.
4. Registrar el pago y guardar la venta.
5. Inmediatamente hacer clic en **`Copiar mensaje al cliente`** (o en la lista de ventas) y pegar el texto en el chat de WhatsApp del cliente.
6. **Prohibido:** Inventar textos propios o pasar solo la clave sin las advertencias de garantía.

### 9.2. Procedimiento para Renovar un Servicio
1. Localizar al cliente en `/clients` o en `/administracion` (en Cobros del Día).
2. Verificar el comprobante de pago enviado por el cliente en WhatsApp.
3. Hacer clic en los tres puntos `...` del cliente -> **`Renovar Servicio`**.
4. Seleccionar los meses pagados y el método de pago recibido.
5. Enviar el mensaje de confirmación de renovación que genera el sistema.

### 9.3. Procedimiento para Dar Garantía (Falla de Cuenta o Perfil)
1. Buscar al cliente en `/clients`.
2. Ir a `...` -> **`Garantía (Auto)`**.
3. El sistema buscará otro perfil del mismo servicio que esté `LIBRE` y hará el intercambio.
4. La fecha de corte del cliente **no cambiará** (se preservan los días que ya pagó).
5. Copiar el mensaje oficial de garantía que explica cómo cerrar sesión en el televisor y le entrega las nuevas credenciales.

### 9.4. Procedimiento para Dar de Baja (Cliente que No Renueva)
1. Ir a `/clients` y ubicar al cliente vencido.
2. Hacer clic en `...` -> **`Liberar Perfil`**.
3. **Paso Obligatorio:** Ingresar un **NUEVO PIN** de 4 dígitos para ese perfil en la plataforma de streaming y escribirlo en la app.
4. El perfil volverá a estar `LIBRE` en el inventario con el nuevo PIN, listo para ser vendido a otro cliente sin riesgo de intrusos.

### 9.5. Errores Críticos que Deben Evitarse a Toda Costa
- ❌ **Borrar ventas a ciegas:** Si se borra una venta de prueba, asegurarse de que el perfil en inventario quede `LIBRE` y sin cliente asignado.
- ❌ **Crear fichas duplicadas:** Si un cliente cambia de número a `@usuario`, usar la herramienta de **Fusión de Clientes** en vez de crear un cliente nuevo desde cero.
- ❌ **No cambiar el PIN al liberar:** Si liberas un perfil sin cambiar el PIN, el cliente anterior podrá seguir viendo gratis y le bloqueará la pantalla al nuevo comprador.
- ❌ **Modificar correos de cuentas madres:** Las cuentas de proveedores nunca deben ser modificadas en correo ni clave principal sin autorización del administrador.

---
*Manual actualizado y verificado para la versión en producción de Estratosfera.*
