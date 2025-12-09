-- CreateTable
CREATE TABLE "Client" (
    "celular" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "servicio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre_perfil" TEXT NOT NULL,
    "pin" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'LIBRE',
    "accountId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InventoryAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" TEXT NOT NULL,
    "perfilId" INTEGER NOT NULL,
    "estado_pago" TEXT NOT NULL,
    "fecha_inicio" DATETIME NOT NULL,
    "fecha_vencimiento" DATETIME NOT NULL,
    "monto" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Client" ("celular") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "SalesProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
