# WebDAV Server for Joplin

Lekki serwer WebDAV do synchronizacji notatek Joplin, zoptymalizowany pod hosting mydevil.net.

## Wymagania

- Node.js v18+

## Konfiguracja na mydevil.net

1. W panelu DevilWEB dodaj stronę WWW typu **Node.js** dla domeny `notes.wosz.pl`
2. Struktura katalogów na serwerze:
   ```
   /usr/home/LOGIN/domains/notes.wosz.pl/
   ├── users.json     (hasła użytkowników — NIE w public_nodejs!)
   ├── data/          (dane WebDAV — NIE w public_nodejs!)
   └── public_nodejs/
       ├── app.js
       └── package.json
   ```
3. Zaloguj się przez SSH i uruchom:
   ```bash
   cd /usr/home/LOGIN/domains/notes.wosz.pl/public_nodejs
   npm install
   ```
4. Restart aplikacji przez panel DevilWEB lub:
   ```bash
   devil www restart notes.wosz.pl
   ```

## Użytkownicy

Domyślni użytkownicy (hasła w formacie `login:hasło`):

| Login | Hasło |
|-------|-------|
| joplin | joplin |

Aby dodać nowego użytkownika, wygeneruj hash hasła:

```bash
node -e "
const crypto = require('crypto');
const password = 'TWOJE_HASLO';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
console.log(JSON.stringify({user: 'LOGIN', salt, hash}, null, 2));
"
```

## Konfiguracja Joplin

W Joplin: **Preferencje** → **Synchronizacja**:
- **Typ synchronizacji**: WebDAV
- **Serwer WebDAV**: `https://notes.wosz.pl`
- **Nazwa użytkownika**: `joplin`
- **Hasło**: `joplin`

## Zmienne środowiskowe

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| PORT | 3000 | Port nasłuchiwania (na mydevil.net ustawiany przez Passengera) |
| HOST | 127.0.0.1 | Adres IP do bindowania |
| WEBDAV_ROOT | ./data | Katalog z danymi WebDAV |

## Metody WebDAV

Serwer obsługuje: OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, COPY, MOVE
