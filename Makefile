# ============================================================
#  ft_transcendence — Makefile
#  All services run inside Docker containers via docker compose
# ============================================================

NAME	= ft_transcendence

all: up

# Build images and start all containers
up:
	docker compose up --build

# Start containers without rebuilding
start:
	docker compose up

# Stop and remove containers
down:
	docker compose down

# Stop containers without removing
stop:
	docker compose stop

# Rebuild from scratch (remove containers + volumes + images)
re: fclean up

# Show logs for all containers (live)
logs:
	docker compose logs -f

# Show logs for a specific service
# Usage: make log SERVICE=backend
log:
	docker compose logs -f $(SERVICE)

# Show running containers
ps:
	docker compose ps

# Open a shell inside a container
# Usage: make sh SERVICE=backend
sh:
	docker compose exec $(SERVICE) sh

# Remove containers and volumes (keeps images)
clean:
	docker compose down -v

# Remove containers, volumes, and all project images
fclean:
	docker compose down -v --rmi all

.PHONY: all up start down stop re logs log ps sh clean fclean
