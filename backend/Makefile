.PHONY: infra-up infra-down infra-clean

# 1. Khởi chạy Postgres chạy ngầm và NestJS ở chế độ development
infra-up:
	docker compose up -d
	npm run start:dev

# 2. Dừng container mà vẫn giữ lại dữ liệu trong database
infra-down:
	docker compose down

# 3. Dừng container và xoá hết toàn bộ dữ liệu
infra-clean:
	docker compose down -v
