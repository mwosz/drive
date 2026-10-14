# WebDAV Server for Joplin

Lekki serwer WebDAV do synchronizacji notatek Joplin, zoptymalizowany pod hosting mydevil.net.

## Wymagania

- Node.js v18+

## Konfiguracja na mydevil.net

1. W panelu DevilWEB dodaj stronę WWW typu **Node.js** dla domeny `notes.wosz.pl`
2. Struktura katalogów na serwerze:
   ```
   /usr/home/LOGIN/domains/notes.wosz.pl/
   ├── user.js        (skrypt do zarządzania użytkownikami)
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
- **Serwer WebDAV**: `https://drive.wosz.pl`
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
