*This project has been created as part of the 42 curriculum by asdiallo, chajeon, dancel, elxhafer.*

---

# ft_transcendence

> [One-line description of the project]

---

## Description

**ft_transcendence** is a web project built as the final project of the 42 Common Core.

### Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]
- [Feature 4]

---

## Instructions

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24.0+ |
| Docker Compose | 2.0+ |
| Make | any |

### Setup

1. Clone the repository
```bash
git clone [repository URL]
cd [project name]
```

2. Create your environment file
```bash
cp .env.example .env
# Fill in the required values in .env
```

3. Run the project
```bash
make
# or
docker compose up --build
```

4. Open in browser
```
https://localhost
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

# Backend
JWT_SECRET=
JWT_EXPIRES_IN=

# OAuth
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=

# Vault
VAULT_TOKEN=
VAULT_ADDR=
```

### Available Commands

| Command | Description |
|---------|-------------|
| `make` | Build and start all containers |
| `make down` | Stop and remove containers |
| `make re` | Full rebuild from scratch |
| `make logs` | View live logs |
| `make clean` | Remove containers and volumes |
| `make fclean` | Remove containers, volumes, and images |

---

## Team Information

| Member | Role | Responsibilities |
|--------|------|-----------------|
| dancel | Product Owner + Developer | [feature] |
| chajeon | Project Manager + Developer | Security, Docker infrastructure, WAF, Vault, 2FA |
| asdiallo | Tech Lead + Developer | [feature] |
| elxhafer | Developer | [feature] |

---

## Project Management

### Work Organization
- Tasks were divided by module
- Weekly sync meetings every [day] at [time]
- Task tracking via Google sheet

### Tools Used
- **Issue Tracker**: Google sheet
- **Communication**: Slack
- **Version Control**: Git

### Branch Strategy
- `main` — stable, production-ready
- `feat/[feature-name(login)]` — feature branches
  - ex. feat/user-auth(chajeon)
- `fix/[issue(login)]` — bug fixes
  - ex. fix/cors-error(chajeon)
- Pull requests require 1 approvals before merging

---

## Technical Stack

### Frontend
| Technology | Reason |
|-----------|--------|
| [React / Vue / Svelte] | [Why this framework] |
| [Tailwind / Bootstrap] | [Why this CSS framework] |

### Backend
| Technology | Reason |
|-----------|--------|
| [NestJS / Express / Django] | [Why this framework] |
| [Prisma / TypeORM] | [Why this ORM] |

### Database
| Technology | Reason |
|-----------|--------|
| [PostgreSQL / MySQL] | [Why this database] |

### Infrastructure & Security
| Technology | Reason |
|-----------|--------|
| Docker + Docker Compose | Containerization, single-command deployment |
| Nginx + ModSecurity | Reverse proxy, WAF with OWASP CRS |
| HashiCorp Vault | Secret management |
| HTTPS (TLS) | Encrypted external connections |

---

## Database Schema

### Tables

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR | Unique, used for login |
| password_hash | VARCHAR | bcrypt hashed password |
| username | VARCHAR | Display name |
| avatar_url | VARCHAR | Profile picture |
| totp_secret | VARCHAR | 2FA seed (nullable) |
| is_2fa_enabled | BOOLEAN | 2FA toggle |
| created_at | TIMESTAMP | Account creation date |

#### [table2]
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| [column] | [type] | [description] |

### Relationships
- [users] 1 — N [table2]
- [Describe other relationships]

---

## Features List

| Feature | Description | Developer(s) |
|---------|-------------|--------------|
| User Registration & Login | Email + password auth with bcrypt | [login] |
| HTTPS | All connections encrypted via TLS | [login5] |
| Docker Infrastructure | 4-network isolation, single-command run | [login5] |
| WAF / ModSecurity | OWASP CRS, SQLi/XSS protection | [login5] |
| HashiCorp Vault | Secret and credential management | [login5] |
| 2FA Authentication | TOTP-based with QR code registration | [login5] |
| [Feature] | [Description] | [login] |
| Privacy Policy Page | Accessible from footer | [login] |
| Terms of Service Page | Accessible from footer | [login] |

---

## Modules

### Chosen Modules

| Module | Category | Type | Points | Developer(s) |
|--------|----------|------|--------|--------------|
| [Full-Stack Framework] | Web | Major | 2 | [login] |
| [WebSocket Real-Time] | Web | Major | 2 | [login] |
| [User Interaction] | Web | Major | 2 | [login] |
| [Standard User Management] | User Management | Major | 2 | [login] |
| WAF/ModSecurity + HashiCorp Vault | Cybersecurity | Major | 2 | [login5] |
| [Web-Based Game] | Gaming & UX | Major | 2 | [login] |
| [Remote Players] | Gaming & UX | Major | 2 | [login] |
| 2FA | User Management | Minor | 1 | [login5] |
| [OAuth 2.0] | User Management | Minor | 1 | [login] |
| [Tournament System] | Gaming & UX | Minor | 1 | [login] |
| **Total** | | | **TBD** | |

### Point Calculation
- Major modules (2pt each): [N] × 2 = [N]pt
- Minor modules (1pt each): [N] × 1 = [N]pt
- **Total: [N]pt** (minimum required: 14pt)

---

## Individual Contributions

### dancel — Product Owner + Developer
- [Feature or module implemented]
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### chajeon — Project Manager + Developer
- Docker infrastructure (4-network isolation, docker-compose)
- WAF/ModSecurity + HashiCorp Vault module
- HTTPS configuration
- 2FA implementation
- Input validation and security headers
- [Feature or module implemented]
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### asdiallo — Tech Lead + Developer
- [Feature or module implemented]
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### elxhafer — Developer
- [Feature or module implemented]
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]


---

## Resources

### Documentation
- [Docker Documentation](https://docs.docker.com)
- [ModSecurity Reference Manual](https://github.com/SpiderLabs/ModSecurity/wiki)
- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [OWASP CRS Documentation](https://coreruleset.org/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten)
- [Add framework/library docs used]

### AI Usage
- **Tool used**: [Claude / ChatGPT / GitHub Copilot / etc.]
- **Tasks assisted**:
  - [e.g., Docker network architecture design]
  - [e.g., ModSecurity rule tuning]
  - [e.g., Boilerplate code generation]
- **Note**: All AI-generated content was reviewed, tested, and validated by the team before use.
