# eDiskarte Server

The eDiskarte server-side services. Consists of authentication, CRUD operations and etc.

## Prerequisites
- Node.js ver. 18 and up
- Docker Desktop ver. 4.38 and up
- MongoDB Compass ver. 1.45.3 and up



## Installation

1. Download Docker Desktop from this website https://www.docker.com/products/docker-desktop/
 
2. Create an account to be signed in inside the docker desktop

3. Go to the root directory of the project

```bash
cd ediskarte-server
```
4. Create a .env file with these details (omit the <<>>)

```bash
DATABASE_HOST=<<PUT ANY DB HOSTNAME HERE>>
DATABASE_PORT=27017

MONGO_INITDB_ROOT_USERNAME=<<PUT YOUR USERNAME HERE>>
MONGO_INITDB_ROOT_PASSWORD=<<PUT YOUR SECRET PASSWORD HERE>>
MONGO_INITDB_DATABASE=<<NAME OF THE DB>>
```

5. Create the database and the nodejs server

```bash
docker compose --env-file .env up
```

## Start the Server
Go to the /app folder and paste the command in the terminal

```bash
npm run server
```

## Manage Data

1. Open MongoDB Compass

2. Make sure URI is localhost:27017 and enter your custom hostname

3. Click Advanced Connection Options and enter your root username and password

4. Click Save and Connect 
