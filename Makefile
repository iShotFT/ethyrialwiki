SHELL := /bin/bash

up:
	docker compose up -d redis postgres proxy opensearch opensearch-dashboards
	yarn install-local-ssl
	yarn install --pure-lockfile
	yarn dev:watch

build:
	docker compose build --pull outline

test:
	docker compose up -d redis postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test

watch:
	docker compose up -d redis postgres
	NODE_ENV=test yarn sequelize db:drop
	NODE_ENV=test yarn sequelize db:create
	NODE_ENV=test yarn sequelize db:migrate
	yarn test:watch

treefile:
	@echo "Generating tree file for directory: $(dir)"
	@mkdir -p tmp
	@bash -c 'timestamp=$$(date +%Y%m%d_%H%M%S); \
	outfile="tmp/treefile_$${timestamp}.txt"; \
	echo "Directory structure:" > "$$outfile"; \
	find "$(dir)" -type f -name "*" | sort >> "$$outfile"; \
	echo "" >> "$$outfile"; \
	echo "File contents:" >> "$$outfile"; \
	if [ -n "$(ext)" ]; then \
		find "$(dir)" -type f -name "*.$(ext)" -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | while read file; do \
			echo "--- $$file ---" >> "$$outfile"; \
			cat "$$file" >> "$$outfile"; \
			echo "" >> "$$outfile"; \
		done; \
	else \
		find "$(dir)" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | while read file; do \
			echo "--- $$file ---" >> "$$outfile"; \
			cat "$$file" >> "$$outfile"; \
			echo "" >> "$$outfile"; \
		done; \
	fi; \
	echo "Tree file generated at $$outfile"'

destroy:
	docker compose stop
	docker compose rm -f

.PHONY: up build destroy test watch treefile # let's go to reserve rules names
