# WebDAV Server for Joplin

Lekki serwer WebDAV do synchronizacji notatek Joplin, zoptymalizowany pod hosting mydevil.net.

## Wymagania

- Node.js v18+

## Instalacja na serwerze mydevil.net

### 1. Przygotowanie lokalnie

Przed wgraniem na serwer, skompiluj projekt lokalnie:

```bash
cd public_nodejs
npm install
npm run build
```

Kompilacja TypeScript wygeneruje folder `dist/` z plikami JavaScript gotowymi do uruchomienia.

### 2. Dodanie strony WWW

W panelu DevilWEB dodaj stronę WWW typu **Node.js** dla domeny (np. `drive.DOMAIN.pl`).

### 3. Przekopiowanie plików na serwer

Przekopiuj zawartość projektu na serwer, zachowując poniższą strukturę:

```
~/domains/DOMAIN/
├── user.js        (skrypt do zarządzania użytkownikami)
├── users.json     (hasła użytkowników — NIE w public_nodejs!)
├── data/          (dane WebDAV — NIE w public_nodejs!)
└── public_nodejs/
    ├── package.json
    ├── app.js
    ├── action/
    └── utils.js
```

Można to zrobić np. przez `scp` lub `rsync`:

```bash
scp -r public_nodejs/dist user.js users.json data/ LOGIN@ssh.mydevil.net:~/domains/DOMAIN/
```

### 4. Instalacja zależności na serwerze

Zaloguj się przez SSH i zainstaluj zależności:

```bash
cd ~/domains/DOMAIN/public_nodejs
npm install --production
```

### 5. Restart aplikacji

Restart aplikacji przez panel DevilWEB lub:

```bash
devil www restart DOMAIN
```

## Użytkownicy

### Dodawanie użytkowników

Użyj skryptu `user.js` do dodawania lub aktualizacji użytkowników:

```bash
node user.js --user <login> --password <hasło>
```

Przykład:
```bash
node user.js --user joplin --password tajnehaslo
```

Skrypt automatycznie generuje losowy salt i hashuje hasło (pbkdf2, 100 000 iteracji, SHA-512), a następnie zapisuje użytkownika w pliku `users.json`. Jeśli użytkownik już istnieje, jego hasło zostanie zaktualizowane.

### Domyślni użytkownicy

| Login | Hasło |
|-------|-------|
| user | user |

## Konfiguracja Joplin

W Joplin: **Preferencje** → **Synchronizacja**:
- **Typ synchronizacji**: WebDAV
- **Serwer WebDAV**: `https://drive.DOMAIN.pl`
- **Nazwa użytkownika**: `joplin`
- **Hasło**: `USTAWIONE_HASLO`

## Zmienne środowiskowe

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| PORT | 3000 | Port nasłuchiwania (na mydevil.net ustawiany przez Passengera) |
| HOST | 127.0.0.1 | Adres IP do bindowania |
| WEBDAV_ROOT | ./data | Katalog z danymi WebDAV |

## Metody WebDAV

Serwer obsługuje: OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, PROPPATCH, COPY, MOVE
