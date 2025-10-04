# Actual Budget REST API Server

HTTP REST API server udostępniający publiczne API dla Actual Budget.

## Instalacja

```bash
yarn install
```

## Budowanie

```bash
yarn build:all
```

## Uruchomienie

### Podstawowe uruchomienie
```bash
yarn start:rest-api
```

### Uruchomienie z aplikacją webową
```bash
yarn start:with-api
```

Serwer zostanie uruchomiony na porcie 3001.

## Endpointy API

### Health Check
- `GET /health` - sprawdzenie statusu serwera

### Accounts (Konta)
- `GET /api/accounts` - pobierz wszystkie konta

### Transactions (Transakcje)  
- `GET /api/transactions?accountId=XXX&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - pobierz transakcje

### Categories (Kategorie)
- `GET /api/categories` - pobierz wszystkie kategorie

### Payees (Odbiorcy)
- `GET /api/payees` - pobierz wszystkich odbiorców

## Przykłady użycia

```bash
# Sprawdzenie statusu
curl http://localhost:3001/health

# Pobierz konta
curl http://localhost:3001/api/accounts

# Pobierz transakcje dla konta
curl "http://localhost:3001/api/transactions?accountId=account-123&startDate=2024-01-01&endDate=2024-12-31"
```

## Konfiguracja

Utwórz plik `.env` w katalogu głównym:

```env
PORT=3001
ACTUAL_DATA_DIR=./actual-data
ACTUAL_SERVER_URL=https://your-actual-server.com  
ACTUAL_PASSWORD=your-password
```
