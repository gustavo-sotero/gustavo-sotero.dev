FROM node:lts-alpine as base
RUN apk add tzdata
ENV TZ=America/Sao_Paulo
WORKDIR /app
COPY package*.json ./
EXPOSE 3000


FROM base as production
RUN apk add tzdata
ENV TZ=America/Sao_Paulo
WORKDIR /app

ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN npm run build

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

CMD ["npm", "start"]


FROM base as dev
ENV NODE_ENV=development
RUN npm install 
COPY . .
CMD npm run dev
