FROM node:20-slim

WORKDIR /app

# Instalar dependencias del sistema (Debian/Ubuntu style)
# build-essential incluye make, gcc, g++, etc.
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias
COPY package.json ./

# Instalar dependencias de Node
RUN npm install --no-package-lock

# Copiar código fuente
COPY . .

# Exponer el puerto
EXPOSE 4000

# Persistencia de Sesión (Configurar en Railway UI -> Volumes -> /app/auth_session_v4)
# VOLUME ["/app/auth_session_v4"]

# Comando de inicio
CMD ["node", "index.js"]
