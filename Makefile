NANOBOT_ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))..

.PHONY: build serve dev clean start stop

build:
	cd frontend && npm run build

serve:
	cd $(NANOBOT_ROOT) && python3 -m dashboard.server

dev:
	cd frontend && npm run dev

start:
	@echo "Starting gateway + dashboard..."
	@cd $(NANOBOT_ROOT) && nanobot gateway >> $(NANOBOT_ROOT)/gateway.log 2>&1 &
	@cd $(NANOBOT_ROOT) && python3 -m dashboard.server &
	@echo "gateway  → $(NANOBOT_ROOT)/gateway.log"
	@echo "dashboard → $(NANOBOT_ROOT)/dashboard.log"

stop:
	@-pkill -f "nanobot gateway" 2>/dev/null; true
	@-pkill -f "dashboard.server" 2>/dev/null; true
	@echo "Stopped."

clean:
	rm -rf static frontend/node_modules
