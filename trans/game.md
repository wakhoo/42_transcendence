# 🎮 MODULE JEU — ARCHITECTURE & FLUX WEBSOCKETS (NestJS / Socket.io)

Ce document détaille l'architecture interne du module de jeu temps réel construit sur NestJS, Socket.io, et TypeORM avec MariaDB.

---

## 📌 1. SÉPARATION DES RESPONSABILITÉS (Single Responsibility Principle)

Notre architecture divise clairement le réseau de la logique métier pour rester propre, maintenable et découplée :

### A. `GameGateway` (Couche Réseau — Le Standardiste)
* **Namespace dédié (`/game`) :** Évite les collisions avec le Chat qui écoute sur le namespace global (`/`).
* **Sécurité & Authentification (`handleConnection`) :** Vérifie le token JWT de chaque socket connectée. Impossible d'entrer dans le salon sans être identifié dans MariaDB.
* **Le carnet d'adresses réseau (`gameSocketUserMap`) :** Une `Map<string, number>` stockée en mémoire vive (RAM) qui fait la traduction instantanée entre un `socket.id` volatil (généré à chaque refresh/reconnexion par le navigateur) et l'ID fixe de l'utilisateur dans la base de données.
* **Aucun calcul métier :** La Gateway se contente de relayer les ordres des clients vers le `GameService` et de diffuser les mises à jour aux rooms Socket.io.

### B. `GameService` (Couche Métier — Le Cerveau & L'Arbitre)
* **État en mémoire vive (RAM via `activeGames`) :** Stocke toutes les parties en cours dans une `Map<number, GameSession>`. Cela garantit des performances en temps réel (< 1ms de latence) sans saturer la base de données de requêtes de lecture/écriture en cours de jeu.
* **Gestion du temps et cycles de jeu :** Gère les `setInterval` pour les chronomètres de 60s, la rotation des dessinateurs et la validation des mots devinés (`checkGuess`).
* **Zéro fuite mémoire :** Nettoyage rigoureux des `clearInterval` lors des fins de round, annulations de partie, ou déconnexions inattendues d'un joueur.
* **Persistance différée via TypeORM :** Ne communique avec MariaDB (`MatchHistoryEntity`) qu'au coup de sifflet final pour enregistrer l'historique de la partie. Une fois écrit, le salon en RAM est détruit (`activeGames.delete`).

---

## 🔄 2. RÉSCRIPTION DES DÉPENDANCES CIRCULAIRES (`forwardRef`)
La Gateway injecte `GameService` (et `ChatService`, pour créer/rejoindre le vrai `Channel` associé à une room) via `@Inject(forwardRef(() => GameService))` / `forwardRef(() => ChatService)`. `GameService` importe de son côté `gameSocketUserMap` directement depuis `game.gateway.ts` — c'est un `Map` exporté au niveau du module (pas une injection DI) : c'est comme ça que le Service retrouve le `socket.id` du dessinateur pour lui envoyer `secret_word` en privé, sans dépendre de la Gateway elle-même.

**Grâce de reconnexion :** `handleDisconnect` n'acte pas un départ immédiatement — il attend `RECONNECT_GRACE_MS` (8000ms) avant d'appeler `handleDisconnection`, pour qu'un refresh de page (disconnect + reconnect quasi instantané) n'annule pas la partie ou ne transfère pas les droits admin pour rien.

---

## 📡 3. TABLEAU DES ÉVÉNEMENTS WEBSOCKETS

Rooms publiques et **privées** (avec code d'accès, `maxMembers`) sont toutes les deux supportées — l'état est porté par `session.type` / `session.code` et renvoyé au client via `room_info`.

| Événement Reçu | Émetteur | Action du Backend / Service | Diffusion via `emit()` |
| :--- | :--- | :--- | :--- |
| **`create_room`** | Créateur | Crée la session RAM + le vrai `Channel` en base, rejoint la room Socket.io. | `room_created` (créateur), `update_players`, `new_admin` |
| **`join_room`** | Invités | Ajoute le joueur à la session RAM + au `Channel` (chat), refuse les joueurs kické (`kicked_from_game`). | `update_players`, `new_admin`, `room_info`, `game_state_sync` (si partie déjà en cours) |
| **`join_room_as_spec`** | Spectateur | Rejoint la room Socket.io **sans** rejoindre le chat — c'est le mécanisme du mode spectateur. | `room_info` (`isSpectator: true`), `update_players`, `game_state_sync` |
| **`start_game`** | Créateur (admin) | Refuse si non-admin (`not_admin`). Sinon désigne le 1er dessinateur, tire un mot, lance le chrono de 60s. | `round_start`, `word_hint`, `secret_word` (privé au dessinateur), `timer_update` (chaque seconde) |
| **`draw`** | Dessinateur actif | Enregistre le tracé dans `historicDraw` (RAM). | `draw` (relayé au reste du salon) |
| **`clear_canvas`** | Dessinateur actif | Autorisé seulement si l'émetteur est bien le dessinateur courant. | `clear_canvas` (broadcast au salon) |
| **`leave_room`** | Client | Quitte la room Socket.io et déclenche `handleDisconnection`. | `update_players`, `new_admin`, `drawer_left`, ou `game_cancelled` si $< 2$ joueurs |
| *(mot deviné, via le chat)* | — | `checkGuess` valide le mot dans le message. | `word_found`, puis si tout le monde a trouvé : `round_end` + `classement` |
| *(fin du chrono)* | — | Le round se termine sans que tous aient trouvé. | `round_end`, `classement`, puis `round_break` ou `game_over` (fin de partie) |
| **`disconnect`** *(auto)* | Navigateur / Client | Après le délai de grâce de 8s : nettoie la RAM, retire le joueur. | `update_players`, `drawer_left`, ou `game_cancelled` si $< 2$ joueurs |

D'autres événements existent en support : `get_my_id` (résout le `userId` du socket courant), `kicked_from_game` / `game_closed` (modération admin), `game_invite` (invitation envoyée via le chat).