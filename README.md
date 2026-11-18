# vue-offline-first

This is a starter template for offline first application. It uses CouchDb in the backend and PouchDb in the frontend.

## Project Structure

This is multi-module project spanning an entire scope of a fullstack project. CouchDB is not JS based, so it is launched as a separate docker service. The project is split into three separate directories src/database, src/services, src/web to represent the fullstack.

| Project                    | description                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `src/database/db-config`   | Db configuration for both couch db and pouch db instances          |
| `src/service/auth-service` | Authentication service responsible for all auth actions. JWT based |
| `src/service/site`         | View Single Page Application                                       |
| `src/service/local-db`     | PouchDB database logic for use within a web worker                 |

## Commands

| code                                                                        | description                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm install`                                                               | install dependencies for all projects.                                              |
| `nvm use`                                                                   | Use node version specified in projects .nvmrc file. (NVM needs installing)          |
| `nvm run test`                                                              | Test all projects                                                                   |
| `nvm run clean`                                                             | Clean all projects                                                                  |
| `nvm run validate`                                                          | Validate all projects                                                               |
| `nvm run build`                                                             | Build all the projects                                                              |
| `nvm run serve`                                                             | Run web site and admin service for live development                                 |
| `docker compose up -d`                                                      | Run docker in test mode, gives you a database to work against                       |
| `docker compose -f compose.yaml -f compose.test.yaml up -d`                 | Run docker container in test mode, everything is deployed in a docker image locally |
| `docker compose -f compose.yaml -f compose.test.yaml down --remove-orphans` | Removes docker container in test mode, gives you database site and everything       |

## Usage Commands

### Configure CouchDB for Live Environment

By default CouchDB uses username:`admin` and password:`password`. To deploy in live environment simply add a `.env` file in root with the following settings.

```sh
COUCHDB_USER=prodadmin
COUCHDB_PASSWORD=YourSecureServerPassword
```

_`.gitignore` is configured to ignore `.env` file._

### View CouchDB

When running it live or in production upi can see it here [http://localhost:5984/_utils](http://localhost:5984/_utils). Use the credentials you set up to view the data.

## Issues

### VS CODE port forwarding

If running in a port forwarding session be sure that all the ports are available as VSCODE fails to detect them. Seems to be an issue they have causes in a recent build.
