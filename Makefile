.PHONY: up down migrate scrape scrape-all harvest psql

up:
	docker compose up -d

down:
	docker compose down

migrate:
	pnpm --filter @workspace/db migrate

# make scrape SOURCE=hackernews
scrape:
	cd pipeline && uv run python -m jobhunter scrape $(SOURCE)

# make scrape-all SKIP="remotive remoteok"
scrape-all:
	cd pipeline && uv run python -m jobhunter all $(if $(SKIP),--skip $(SKIP),)

harvest:
	cd pipeline && uv run python -m jobhunter harvest

psql:
	docker exec -it jobhunter-db psql -U jobhunter
