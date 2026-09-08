# KeyVault

Cofre simples e dockerizado para guardar logins/senhas criptografados, com suporte
a contas Gmail, Outlook e Meta Ads (e-mail + senha do e-mail + senha do Facebook +
2FA gerado automaticamente na tela, sem apps externos), alem de cookies e proxy
opcionais.

## Como funciona

- Login proprio do sistema (usuario admin criado a partir do `.env`).
- Cada credencial e salva com os campos cifrados em repouso (AES-256-GCM) usando
  `ENCRYPTION_KEY`. As senhas do vault (login do sistema) usam bcrypt.
- Para contas do tipo Meta Ads/Outro, se voce cadastrar o "segredo 2FA" (a chave
  base32 fornecida ao ativar a verificacao em duas etapas), o sistema calcula o
  codigo TOTP de 6 digitos na hora, direto na tela de detalhes, com um anel de
  contagem regressiva — nao precisa de Google Authenticator nem nada externo.
- Cookies e proxy sao campos de texto livre opcionais (ficam cifrados junto com o
  resto).

## Subir com Docker

```bash
cp .env.example .env
# edite o .env:
#   ENCRYPTION_KEY=$(openssl rand -hex 32)
#   JWT_SECRET=$(openssl rand -base64 48)
#   ADMIN_EMAIL / ADMIN_PASSWORD -> credenciais do primeiro acesso

docker compose up -d --build
```

Acesse http://localhost:4000 e entre com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`
definidos no `.env`.

> O usuario admin so e criado automaticamente **na primeira vez** (quando o banco
> ainda nao tem nenhum usuario). Depois disso, mudar essas variaveis nao tem
> efeito — troque a senha pela propria interface/API se precisar.

## Rodar sem Docker (dev)

```bash
npm install
cp .env.example .env   # preencha as variaveis
npm run dev
```

## Onde ficam os dados

O banco SQLite fica em `/data/keyvault.db` dentro do container, persistido no
volume `keyvault_data` (ou na pasta `./data` local fora do Docker). Faca backup
desse arquivo — e ele que guarda tudo (ja cifrado, mas ainda assim e o seu cofre).

## Seguranca — pontos importantes

- Guarde `ENCRYPTION_KEY` e o backup do banco em lugares separados. Quem tiver
  as duas coisas consegue decifrar as credenciais.
- Se `ENCRYPTION_KEY` for perdida, os dados cifrados **nao tem como ser
  recuperados**.
- Rode atras de HTTPS em producao (proxy reverso tipo Caddy/Nginx/Traefik) e
  ligue `COOKIE_SECURE=true` nesse caso.
- Nao ha cadastro publico de usuarios — de propósito, para manter isso como um
  cofre privado/interno.
# keyvault
