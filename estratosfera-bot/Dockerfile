FROM node:20-alpine

WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Exponer el puerto
EXPOSE 4000

# Persistencia de Sesión
VOLUME ["/app/auth_session_v4"]

# Comando de inicio
CMD ["node", "index.js"]
