[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

# WebDAV Server for Joplin

A lightweight WebDAV server for Joplin notes synchronization, optimized for mydevil.net hosting.

[🇵🇱 Polska wersja](README.pl.md)

## Requirements

- Node.js v18+

## Installation on mydevil.net Server

### 1. Local Preparation

Before uploading to the server, copy `users.json.example` to `users.json` and build the project locally:

```bash
cp users.json.example users.json
pnpm install
pnpm run build
```

The TypeScript compilation will generate the `dist/` folder with JavaScript files ready to run.

### 2. Add a Web Page

In the DevilWEB panel, add a **Node.js** web page for your domain (e.g. `drive.DOMAIN.pl`).

### 3. Copy Files to the Server

Copy the project contents to the server, preserving the following structure:

```
~/domains/DOMAIN/
├── README.md
├── users.json     (user passwords)
├── data/          (WebDAV data)
├── logs/          (application logs)
└── public_nodejs/ (Node.js application)
    ├── app.js
    ├── action/
    ├── helpers/
    ├── node_modules/
    ├── package.json
    └── package-lock.json
```

You can do this using `scp` or `rsync`:

```bash
scp -r dist/* package.json LOGIN@ssh.mydevil.net:~/domains/DOMAIN/public_nodejs/
scp users.json data/ LOGIN@ssh.mydevil.net:~/domains/DOMAIN/
```

### 4. Install Dependencies on the Server

Log in via SSH and install dependencies (mydevil.net server uses `npm`):

```bash
cd ~/domains/DOMAIN/public_nodejs
npm install --production
```

### 5. Restart the Application

Restart the application via the DevilWEB panel or:

```bash
devil www restart DOMAIN
```

## Users

### Adding Users

Use the `user.js` script to add or update users:

```bash
node user.js --user <login> --password <password>
```

Example:
```bash
node user.js --user joplin --password secretpassword
```

The script automatically generates a random salt and hashes the password (pbkdf2, 100,000 iterations, SHA-512), then saves the user to `users.json`. If the user already exists, the password will be updated.

### Default Users

| Login | Password |
|-------|----------|
| user | user |

## Joplin Configuration

In Joplin: **Preferences** → **Synchronization**:
- **Sync target**: WebDAV
- **WebDAV URL**: `https://drive.DOMAIN.pl`
- **Username**: `joplin`
- **Password**: `YOUR_PASSWORD`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Listening port (on mydevil.net set by Passenger) |
| HOST | 127.0.0.1 | Bind IP address |
| WEBDAV_ROOT | ./data | WebDAV data directory |

## WebDAV Methods

The server supports: OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, COPY, MOVE
