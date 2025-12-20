FROM node:20-alpine

WORKDIR /app

# Copiar dependencias
# Copiar dependencias
COPY package.json ./
# Instalar dependencias de compilación (para bibliotecas nativas como sharp/bufferutil)
# y borrar package-lock para evitar conflictos de plataforma
RUN apk add --no-cache python3 make g++ git
RUN npm install --no-package-lock

# Copiar código fuente
COPY . .

# Exponer el puerto
EXPOSE 4000

# Persistencia de Sesión
VOLUME ["/app/auth_session_v4"]

# Comando de inicio
CMD ["node", "index.js"]
