# 🚚 Komunikator Firmowy - Instrukcja Instalacji

## Co otrzymujesz?

Kompletny system komunikatora z:
- ✅ Backend Node.js z WebSocket
- ✅ Baza danych SQLite (automatyczna)
- ✅ Czat grupowy w czasie rzeczywistym
- ✅ Wideokonferencje WebRTC
- ✅ System pokoi z linkami zaproszeniowymi
- ✅ Responsywny interfejs

## Wymagania

- **Node.js** (wersja 16 lub nowsza) - [Pobierz tutaj](https://nodejs.org/)
- Przeglądarka: Chrome, Firefox, Safari lub Edge
- System: Windows, macOS lub Linux

## Instalacja Krok po Kroku

### 1. Zainstaluj Node.js

**Windows:**
1. Pobierz instalator z https://nodejs.org/
2. Uruchom plik `.msi` i postępuj zgodnie z instrukcjami
3. Zatwierdź wszystkie domyślne opcje

**macOS:**
```bash
# Używając Homebrew
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Sprawdź instalację Node.js

Otwórz terminal/wiersz poleceń i wpisz:
```bash
node --version
npm --version
```

Powinieneś zobaczyć numery wersji (np. v18.17.0 i 9.6.7)

### 3. Zainstaluj zależności projektu

W folderze z projektem uruchom:
```bash
npm install
```

To polecenie zainstaluje:
- express - serwer HTTP
- socket.io - WebSocket do komunikacji w czasie rzeczywistym
- sqlite3 - baza danych
- cors - bezpieczeństwo

### 4. Uruchom serwer

```bash
npm start
```

Zobaczysz komunikat:
```
🚀 ========================================
🚀 Serwer komunikatora działa na porcie 3000
🚀 Otwórz przeglądarkę: http://localhost:3000
🚀 ========================================
```

### 5. Otwórz aplikację

Wpisz w przeglądarce: **http://localhost:3000**

## 🎯 Jak używać?

### Tworzenie pokoju (Organizator)

1. Kliknij **"Utwórz nowy pokój"**
2. Wpisz nazwę pokoju (np. "Dyspozytornia - zmiana poranna")
3. Wpisz swoje imię
4. Wybierz tryb: **Czat** lub **Wideo**
5. Kliknij **"Utwórz pokój"**
6. **Skopiuj link** i wyślij pracownikom (email, WhatsApp, itp.)
7. Kliknij **"Wejdź do pokoju"**

### Dołączanie do pokoju (Pracownicy)

1. Kliknij **"Dołącz przez link"**
2. Wklej otrzymany link
3. Wpisz swoje imię
4. Kliknij **"Dołącz"**

### Czat
- Pisz wiadomości w dolnym polu
- Enter lub "Wyślij" aby wysłać
- Widzisz wszystkich uczestników na górze

### Wideo
- Automatycznie włącza się kamera i mikrofon
- 🎤 - Wycisz/Włącz mikrofon
- 📹 - Wyłącz/Włącz kamerę
- 📞 - Opuść rozmowę

## 🌐 Dostęp przez Internet (Opcjonalnie)

### Opcja 1: ngrok (Najprostsze, darmowe)

1. Pobierz ngrok: https://ngrok.com/download
2. W jednym terminalu uruchom serwer: `npm start`
3. W drugim terminalu: `ngrok http 3000`
4. Otrzymasz publiczny URL (np. https://abc123.ngrok.io)
5. Udostępnij ten URL pracownikom

### Opcja 2: Hosting (Produkcja)

Polecane platformy (darmowe opcje):
- **Render.com** - https://render.com (darmowy tier)
- **Railway.app** - https://railway.app
- **Heroku** - https://heroku.com
- **DigitalOcean** - od $5/miesiąc

## 📂 Struktura Plików

```
komunikator/
├── server.js           # Główny serwer
├── package.json        # Konfiguracja projektu
├── komunikator.db      # Baza danych (tworzy się automatycznie)
└── public/
    ├── index.html      # Interfejs użytkownika
    └── app.js          # Logika klienta (WebSocket, WebRTC)
```

## 🔧 Konfiguracja

### Zmiana portu

W pliku `server.js` znajdź linię:
```javascript
const PORT = process.env.PORT || 3000;
```

Zmień na np. `8080`:
```javascript
const PORT = process.env.PORT || 8080;
```

### Dostęp z innych komputerów w sieci lokalnej

1. Znajdź swój adres IP:
   - Windows: `ipconfig` w cmd
   - Mac/Linux: `ifconfig` lub `ip addr`
   
2. Inne komputery w tej samej sieci mogą wejść pod:
   `http://TWÓJ_ADRES_IP:3000`
   
   Przykład: `http://192.168.1.100:3000`

## 🐛 Rozwiązywanie Problemów

### "Błąd: Port 3000 jest zajęty"

Zamknij inne aplikacje używające portu 3000 lub zmień port.

### "Błąd dostępu do kamery/mikrofonu"

1. Sprawdź uprawnienia przeglądarki (Settings → Privacy → Camera/Microphone)
2. Upewnij się, że używasz HTTPS lub localhost
3. Zamknij inne aplikacje używające kamery (Zoom, Teams, itp.)

### "Cannot find module"

Uruchom ponownie:
```bash
npm install
```

### Baza danych nie działa

Usuń plik `komunikator.db` i uruchom serwer ponownie - utworzy się nowa baza.

## 📊 Jak działa?

### WebSocket (Czat w czasie rzeczywistym)
- Utrzymuje stałe połączenie między przeglądarką a serwerem
- Wiadomości przychodzą natychmiast, bez odświeżania strony
- Działa jak "telefoniczna rozmowa" zamiast SMS-ów

### WebRTC (Wideo)
- Przesyła wideo bezpośrednio między użytkownikami (peer-to-peer)
- Używa darmowych serwerów Google STUN do nawiązania połączenia
- Minimalne opóźnienie, oszczędność serwera

### Baza SQLite
- Lekka baza danych w jednym pliku
- Zapisuje: pokoje, wiadomości, uczestników
- Automatyczne tworzenie tabel przy pierwszym uruchomieniu

## 🚀 Następne Kroki (Produkcja)

Dla pełnego systemu SaaS rozważ:

1. **Autoryzacja** - logowanie użytkowników (JWT, OAuth)
2. **Hosting w chmurze** - AWS, Google Cloud, Azure
3. **HTTPS** - certyfikat SSL (Let's Encrypt - darmowy)
4. **Skalowanie** - Redis dla sesji, PostgreSQL zamiast SQLite
5. **TURN serwer** - dla wideo gdy STUN nie wystarczy
6. **Monitoring** - logi, metryki (PM2, Sentry)
7. **Backup** - automatyczne kopie bazy danych

## 📞 Wsparcie

Jeśli potrzebujesz pomocy:
1. Sprawdź logi w terminalu (gdzie uruchomiłeś serwer)
2. Sprawdź konsolę przeglądarki (F12 → Console)
3. Upewnij się, że wszystkie zależności są zainstalowane

## 📄 Licencja

MIT - możesz używać w projekcie komercyjnym.

---

**Gotowe do użycia! Powodzenia! 🚚**
