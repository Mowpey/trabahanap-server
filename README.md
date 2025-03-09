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
4. Create a .env file with the database port (omit the <<>>)

```bash
DATABASE_PORT=27017
```

5. Create a replica set for mongodb

```bash
docker compose --env-file .env up
```

6. Initiate the replica set of mongoDB
```bash
docker exec -it mongo1 mongosh --eval "rs.initiate({
 _id: \"mongoReplica\",
 members: [
   {_id: 0, host: \"mongo1\"},
   {_id: 1, host: \"mongo2\"},
   {_id: 2, host: \"mongo3\"}
 ]
})"
```
7. cd to /etc/host and append the ff:
```bash
127.0.0.1 mongo1
127.0.0.1 mongo2
127.0.0.1 mongo3
```

8. Check if the docker replica set is running
```bash
docker exec -it mongo1 mongosh --eval "rs.status()"
```

<details markdown="1">
    <summary>Check for reference</summary>
    Current Mongosh Log ID:	6528adb69f801781a9bc0d09
    Connecting to:		mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.0.1
    Using MongoDB:		7.0.2
    Using Mongosh:		2.0.1

    For mongosh info see: https://docs.mongodb.com/mongodb-shell/

    ------
       The server generated these startup warnings when booting
       2023-10-13T02:35:49.994+00:00: Using the XFS filesystem is strongly recommended with the WiredTiger storage engine. See http://dochub.mongodb.org/core/prodnotes-filesystem
       2023-10-13T02:35:50.773+00:00: Access control is not enabled for the database. Read and write access to data and configuration is unrestricted
       2023-10-13T02:35:50.773+00:00: vm.max_map_count is too low
    ------

    {
      set: 'myReplicaSetName',
      date: ISODate("2023-10-13T02:38:46.688Z"),
      myState: 1,
      term: Long("1"),
      syncSourceHost: '',
      syncSourceId: -1,
      heartbeatIntervalMillis: Long("2000"),
      majorityVoteCount: 2,
      writeMajorityCount: 2,
      votingMembersCount: 3,
      writableVotingMembersCount: 3,
      optimes: {
        lastCommittedOpTime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
        lastCommittedWallTime: ISODate("2023-10-13T02:38:40.541Z"),
        readConcernMajorityOpTime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
        appliedOpTime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
        durableOpTime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
        lastAppliedWallTime: ISODate("2023-10-13T02:38:40.541Z"),
        lastDurableWallTime: ISODate("2023-10-13T02:38:40.541Z")
      },
      lastStableRecoveryTimestamp: Timestamp({ t: 1697164690, i: 1 }),
      electionCandidateMetrics: {
        lastElectionReason: 'electionTimeout',
        lastElectionDate: ISODate("2023-10-13T02:36:30.454Z"),
        electionTerm: Long("1"),
        lastCommittedOpTimeAtElection: { ts: Timestamp({ t: 1697164580, i: 1 }), t: Long("-1") },
        lastSeenOpTimeAtElection: { ts: Timestamp({ t: 1697164580, i: 1 }), t: Long("-1") },
        numVotesNeeded: 2,
        priorityAtElection: 1,
        electionTimeoutMillis: Long("10000"),
        numCatchUpOps: Long("0"),
        newTermStartDate: ISODate("2023-10-13T02:36:30.508Z"),
        wMajorityWriteAvailabilityDate: ISODate("2023-10-13T02:36:31.065Z")
      },
      members: [
        {
          _id: 0,
          name: 'mongo1:27017',
          health: 1,
          state: 1,
          stateStr: 'PRIMARY',
          uptime: 177,
          optime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
          optimeDate: ISODate("2023-10-13T02:38:40.000Z"),
          lastAppliedWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          lastDurableWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          syncSourceHost: '',
          syncSourceId: -1,
          infoMessage: '',
          electionTime: Timestamp({ t: 1697164590, i: 1 }),
          electionDate: ISODate("2023-10-13T02:36:30.000Z"),
          configVersion: 1,
          configTerm: 1,
          self: true,
          lastHeartbeatMessage: ''
        },
        {
          _id: 1,
          name: 'mongo2:27017',
          health: 1,
          state: 2,
          stateStr: 'SECONDARY',
          uptime: 146,
          optime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
          optimeDurable: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
          optimeDate: ISODate("2023-10-13T02:38:40.000Z"),
          optimeDurableDate: ISODate("2023-10-13T02:38:40.000Z"),
          lastAppliedWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          lastDurableWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          lastHeartbeat: ISODate("2023-10-13T02:38:46.609Z"),
          lastHeartbeatRecv: ISODate("2023-10-13T02:38:45.564Z"),
          pingMs: Long("0"),
          lastHeartbeatMessage: '',
          syncSourceHost: 'mongo1:27017',
          syncSourceId: 0,
          infoMessage: '',
          configVersion: 1,
          configTerm: 1
        },
        {
          _id: 2,
          name: 'mongo3:27017',
          health: 1,
          state: 2,
          stateStr: 'SECONDARY',
          uptime: 146,
          optime: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
          optimeDurable: { ts: Timestamp({ t: 1697164720, i: 1 }), t: Long("1") },
          optimeDate: ISODate("2023-10-13T02:38:40.000Z"),
          optimeDurableDate: ISODate("2023-10-13T02:38:40.000Z"),
          lastAppliedWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          lastDurableWallTime: ISODate("2023-10-13T02:38:40.541Z"),
          lastHeartbeat: ISODate("2023-10-13T02:38:46.595Z"),
          lastHeartbeatRecv: ISODate("2023-10-13T02:38:45.568Z"),
          pingMs: Long("0"),
          lastHeartbeatMessage: '',
          syncSourceHost: 'mongo1:27017',
          syncSourceId: 0,
          infoMessage: '',
          configVersion: 1,
          configTerm: 1
        }
      ],
      ok: 1,
      '$clusterTime': {
        clusterTime: Timestamp({ t: 1697164720, i: 1 }),
        signature: {
          hash: Binary.createFromBase64("AAAAAAAAAAAAAAAAAAAAAAAAAAA=", 0),
          keyId: Long("0")
        }
      },
      operationTime: Timestamp({ t: 1697164720, i: 1 })
    }
</details>

9. Connect to the mongodb using on of the ff:
```sh
mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=mongoReplica
mongodb://localhost:27017,localhost:27018,localhost:27019/my-database-name?replicaSet=mongoReplica
```


## Setting up Prisma
 Create a .env file containing mongodb URI and paste it in the DATABASE_URL


## Start the Server
1. Go to the /app folder and paste the command in the terminal

```bash
npm install
```

2. Go to the /app folder and paste the command in the terminal

```bash
npm run server
```
## JWT AUTHENTICATION
1. In your .env file inside /app, create a JWT_SECRET string which contains your super secret combination
