# Bot de RPG para Discord

Projeto pronto para criar e gerenciar fichas de RPG dentro do Discord.

## Comandos
- `/criar-personagem` abre um modal e cria uma ficha para um jogador
- `/ficha jogador:@usuario` mostra as fichas cadastradas daquele jogador no servidor
- `/meus-personagens` mostra todas as suas fichas no servidor
- `/editar-personagem` altera qualquer campo da ficha, incluindo a imagem
- `/apagar-personagem` remove uma ficha pelo ID
- `/admin-rpg adicionar|remover|listar` controla quem pode gerenciar personagens neste servidor

## Regras de permissão
- `OWNER_ID`: dona fixa do bot, com acesso total
- admins adicionados por `/admin-rpg`: podem criar, editar e apagar fichas
- membros comuns: podem consultar `/ficha` e `/meus-personagens`

## Como usar
1. Copie `.env.example` para `.env`
2. Preencha `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` e `OWNER_ID`
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Registre os comandos:
   ```bash
   npm run deploy
   ```
5. Inicie o bot:
   ```bash
   npm start
   ```

## Como a imagem funciona
- em `/criar-personagem`, você pode enviar um anexo na opção `imagem`
- em `/editar-personagem`, escolha `campo: imagem` e envie um anexo em `imagem` ou uma URL em `valor`
- a ficha exibe a imagem no embed

## Campos suportados em `/editar-personagem`
- nome
- sobrenome
- idade
- raca
- familia
- cla
- genero
- classe
- rank
- origem
- aparencia
- personalidade
- historia
- habilidades
- inventario
- imagem

## Estrutura
- `index.js`: inicialização do bot e tratamento das interações
- `deploy-commands.js`: registro dos slash commands
- `src/database.js`: criação do banco SQLite
- `src/commands`: comandos do bot
- `src/utils`: embeds e permissões

## Observações
- as fichas são separadas por servidor com `guild_id`
- a lista de admins também é separada por servidor
- se você quiser, depois dá para expandir com atributos como força, agilidade, mana, HP, XP e sistema de paginação por botões
