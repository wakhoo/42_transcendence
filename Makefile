# ============================================================
#  ft_transcendence — Makefile
#  All services run inside Docker containers via docker compose
# ============================================================
DC=docker compose -f ./srcs/docker-compose.yml

NAME	= ft_transcendence

all: up

# Build images and start all containers
up:
	$(DC) up -d --build

# Start containers without rebuilding
start:
	$(DC) up

# Stop and remove containers
down:
	$(DC) down

# Stop containers without removing
stop:
	$(DC) stop

# Rebuild from scratch (remove containers + volumes + images)
re: fclean up

# Show logs for all containers (live)
logs:
	$(DC) logs -f

# Show logs for a specific service
# Usage: make log SERVICE=backend
log:
	$(DC) logs -f $(SERVICE)

# Show running containers
ps:
	$(DC) ps

# Open a shell inside a container
# Usage: make sh SERVICE=backend
sh:
	$(DC) exec $(SERVICE) sh

# Remove containers and volumes (keeps images)
clean:
	$(DC) down -v

# Remove containers, volumes, and all project images
fclean:
	$(DC) down -v --rmi all

.PHONY: all up start down stop re logs log ps sh clean fclean
