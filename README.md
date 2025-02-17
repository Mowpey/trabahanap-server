#eDiskarte Server

The eDiskarte server-side services. Consists of authentication, CRUD operations and etc.

##Prerequisites
- Node.js ver. 18 and up
- Docker Desktop ver. 4.38 and up
- MongoDB Compass ver. 1.45.3 and up



## Installation

> Download Docker Desktop from this website https://www.docker.com/products/docker-desktop/
 
> Create an account to be signed in inside the docker desktop

> Go to the root directory of the project

```bash
cd ediskarte-server
```
> Create a .env file with these details

```bash
DATABASE_HOST=<<PUT ANY DB HOSTNAME HERE>>
DATABASE_PORT=27017

MONGO_INITDB_ROOT_USERNAME=<<PUT YOUR USERNAME HERE>>
MONGO_INITDB_ROOT_PASSWORD=<<PUT YOUR SECRET PASSWORD HERE>>
MONGO_INITDB_DATABASE=<<NAME OF THE DB>>

SERVER_HOST=<<PUT YOUR SERVER NAME>>
SERVER_PORT=3000
```

> Create the database and the nodejs server

```bash
docker compose --env-file .env up
```
## Manage Data

> Open MongoDB Compass

> Make sure URI is localhost:27017 and enter any name

> Click Advanced Connection Options and enter your root username and password

> Click Save and Connect 
