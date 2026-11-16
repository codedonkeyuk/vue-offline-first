# db-config

Used to validate / constrain both couchdb and pouchdb databases.

## Commands

| code               | description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `npm install`      | install dependencies                                                       |
| `nvm use`          | use node version specified in projects .nvmrc file. (NVM needs installing) |
| `npm run test`     | run node:test library                                                      |
| `npm run coverage` | runs node test coverage report                                             |
| `npm run clean`    | clean project using prettier                                               |
| `npm run validate` | validate code using typescript compiler. Does not generate files           |
| `npm run build`    | build ES module using typescript compiler                                  |

## General Instructions

### Update libraries

How to update libraries to the latest

```bash
npx npm-check-updates -u
npm install
```

### Update node

This project has been set up to use a specific version of node via `.nvmrc` file. Run this command to update to you local version.

```bash
nvm ls-remote --lts # see latest build
nvm install node # update to the latest build
node -v > .nvmrc # this project to the latest
```
