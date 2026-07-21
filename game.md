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
Étant donné que la Gateway doit appeler le Service, mais que le Service doit également accéder à la `gameSocketUserMap` exportée par la Gateway (pour envoyer le mot secret en privé au dessinateur via son `socket.id`), nous utilisons le décorateur `@Inject(forwardRef(() => GameService))` dans le constructeur de la Gateway. Cela indique au compilateur NestJS d'initialiser les deux classes de manière croisée sans provoquer de plantage au démarrage.

---

## 📡 3. TABLEAU DES ÉVÉNEMENTS WEBSOCKETS

| Événement Reçu | Émetteur | Action du Backend / Service | Diffusion globale via `emit()` |
| :--- | :--- | :--- | :--- |
| **`create_room`** | Créateur (Joueur 1) | Crée la session RAM et fait rejoindre le salon `channelId`. | `update_players` (liste des joueurs avec pseudos) |
| **`join_room`** | Invités (Joueurs 2+) | Ajoute l'ID à la session RAM et au salon Socket.io. | `update_players` + `message_channel` |
| **`start_game`** | Créateur | Lance le jeu, désigne le 1er dessinateur et lance le chrono. | `round_start`, `word_hint` (+ `secret_word` en privé au dessinateur) |
| **`draw`** | Dessinateur actif | Enregistre le tracé dans `historicDraw` (RAM). | `draw` (transmet les coordonnées à tout le salon) |
| **`request_history`**| Joueur (reconnexion) | Récupère l'historique de dessin pour rafraîchir le canvas. | `request_history` (envoyé en privé au client demandeur) |
| **`disconnect`** *(auto)* | Navigateur / Client | Nettoie la RAM, retire le joueur et gère les départs en direct.| `update_players`, `drawer_left`, ou `game_cancelled` si $< 2$ joueurs |