.PHONY: build serve dev clean

build:
	cd frontend && npm run build

serve:
	cd $(dir $(abspath $(lastword $(MAKEFILE_LIST)))).. && python3 -m dashboard.server

dev:
	cd frontend && npm run dev

clean:
	rm -rf static frontend/node_modules
