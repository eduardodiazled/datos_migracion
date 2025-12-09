-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT NOT NULL,
    "perfilId" INTEGER,
    "estado_pago" TEXT NOT NULL,
    "metodo_pago" TEXT,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_vencimiento" DATETIME NOT NULL,
    "monto" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("celular") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "SalesProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("clienteId", "createdAt", "estado_pago", "fecha_inicio", "fecha_vencimiento", "id", "metodo_pago", "monto", "perfilId", "updatedAt") SELECT "clienteId", "createdAt", "estado_pago", "fecha_inicio", "fecha_vencimiento", "id", "metodo_pago", "monto", "perfilId", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
