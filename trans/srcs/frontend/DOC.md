# Frontend Documentation — Transcendence

This documentation explains how the frontend is organized and how navigation works between pages. It does not contain code snippets: the goal is to understand the general behavior, not the implementation details.

## 1. What happens on load

When the browser opens the application, it loads an almost empty HTML page containing only a single empty area meant to host the application, plus a reference to the script that starts React.

This entry script is the first JavaScript file executed. Its only job is to tell React: "take control of this empty area of the page and render the application inside it." It's the technical entry point, and it contains no business logic.

Once React has started, a root component takes over. Based on the URL shown in the address bar, it decides which page should be displayed to the user.

## 2. Routing: how the browser chooses which page to show

The application is a "single page application": there is really only one actual HTML page. When a link or button that changes the page is clicked, the browser does not reload everything from the server — React intercepts the URL change and swaps the displayed content for the correct page, instantly, without a reload.

The root component holds the list of possible paths (the site root, `/login`, `/signUp`, `/dashboard`, `/game`, `/profile`, plus the auth-only landing pages `/auth/callback`, `/auth/2fa`, and `/2fa/prompt`) and matches each of these paths to a specific page. It acts as a switchboard: as soon as the URL matches one of these paths, the associated page is displayed.

## 3. User journey, page by page

**Home page (site root)**
This is the entry point visible to a non-logged-in visitor. It offers two choices: log in or create an account. Each button changes the URL and leads to the corresponding page.

**Login page**
Lets an already-registered user enter their email and password. If the credentials are valid, the user is automatically redirected to their dashboard. If the login fails, an error message is shown instead, without changing pages. A "back" button lets the user return to the previous screen.

**Sign-up page**
Lets a new user create an account (email, username, password). Once the account is created, the user is automatically logged in and sent straight to their dashboard, without having to go through the login page first.

**Dashboard**
This is the main page once logged in. It acts as a central hub: list of connected players with live online/offline presence, a real-time general chat, and access to the different game modes (join a public room, or create a public or private room). If a user reaches this page without being logged in, they are automatically sent back to the login page.

**Profile page**
Lets the logged-in user view and edit their own account: avatar, username, email, password, and 2FA status. Reachable from the dashboard once logged in.

**Game page**
The page where a match actually takes place: a shared drawing canvas, the current round's word hint and timer, live scores, and a spectator mode for anyone who joins after a round has already started. Both public and private (code-protected) rooms are supported.

**Auth landing pages**
A few routes exist purely as landing spots the backend redirects to rather than places a user navigates to directly: `/auth/callback` completes a Google OAuth login, `/auth/2fa` completes a Google OAuth login when the account has 2FA enabled, and `/2fa/prompt` is the optional screen for setting up (enabling) 2FA on an existing account.

The typical path for a new user is therefore: home → sign-up (or login) → dashboard → game. The login and sign-up pages also include a way back to the previous screen so users can backtrack without losing their place.

## 4. How the user stays logged in

After a successful login or sign-up, an authentication token is kept in the browser. This token is what gets presented to the server every time the page needs personal information (the list of users, chat messages, etc.), to prove who is making the request without having to re-enter a password for every action. As long as this token is present, protected pages (like the dashboard) remain accessible; if it's missing, the user is sent back to the login page.

## 5. Communication with the server

The frontend talks to the server in two different ways depending on the need:

- For one-off actions (logging in, signing up, fetching the list of users or a conversation's history), the frontend sends a standard request to the server and waits for a single response.
- For anything that needs to update live without the user having to reload anything (new chat messages, a game's countdown timer), the frontend keeps a permanent connection open with the server. This connection lets the server push information to the browser as soon as something happens, instead of waiting for the browser to ask again.

In development, requests meant for the server are automatically redirected to the service running locally, allowing the frontend and backend to run on two different ports while still communicating normally.

## 6. Role of the files and folders

- **The base HTML page**: the minimal skeleton loaded by the browser, whose only job is to host the React application.
- **The entry script**: starts React and mounts it into the page.
- **The root component**: defines the list of available pages and the routing between them.
- **The pages folder**: contains one file per screen of the application (home, login, sign-up, dashboard, profile, game, plus the auth landing pages). Each file is responsible for the display and behavior of a single screen.
- **The components folder**: contains reusable pieces that can be plugged into several pages (for example the countdown timer used on the game page), instead of duplicating the same block in every page that needs it.
- **The global stylesheet**: defines the overall look of the application (fonts, base colors, etc.), applied across all pages.
- **The dev server configuration**: describes how the project should be started locally, including redirecting requests to the backend server during development.