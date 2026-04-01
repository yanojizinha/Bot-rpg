# Bot de RPG para Discord

Projeto pronto para um bot de RPG com:

- `/criar-personagem`
- `/ficha`
- `/meus-personagens`
- `/editar-personagem`
- `/apagar-personagem`
- `/admin-rpg`

## 1) Instalação local

```bash
npm install
```

Copie:

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
OWNER_ID=...
DATA_DIR=./data
```

Registre os comandos:

```bash
npm run deploy
```

Inicie:

```bash
npm start
```

## 2) Railway

### Recomendado
Como esse projeto salva os dados em arquivo JSON, no Railway você deve criar um **Volume** e montar em `/data`, para não perder os dados quando houver novo deploy ou reinício. Railway documenta volumes como armazenamento persistente para serviços, e a própria documentação separa volumes dentro das opções de Data & Storage. citeturn750101search1turn750101search3

Depois disso, adicione a variável:

```env
DATA_DIR=/data
```

### Variáveis no Railway
No serviço do Railway, abra **Variables** e adicione:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `OWNER_ID`
- `DATA_DIR=/data`

A documentação do Railway mostra que variáveis ficam no serviço e podem ser adicionadas pela aba **Variables**, inclusive em modo bruto. citeturn750101search9turn750101search12

### Deploy
Você pode fazer deploy pelo GitHub ou pela CLI. Railway também documenta `railway up` para subir o projeto pela CLI. citeturn750101search8turn750101search11

### Start command
Se o Railway não detectar sozinho, configure o Start Command como:

```bash
npm start
```

A documentação do Railway diz que o Start Command define o processo usado para iniciar o deploy e que, para apps Node, o Railpack tenta usar `npm start` quando esse script existe no `package.json`. citeturn750101search4turn750101search13
