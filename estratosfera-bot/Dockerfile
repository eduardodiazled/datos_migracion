FROM node:20-alpine

WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Exponer el puerto
EXPOSE 4000

# Comando de inicio
CMD ["node", "index.js"]
