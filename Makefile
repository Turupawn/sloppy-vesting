-include .env

# Cuenta #0 de anvil. Publica y conocida por todo el mundo: solo local.
ANVIL_PK := 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Con que se firma en Hoodi. Si exportaste PRIVATE_KEY (o la pusiste en
# el .env, que este Makefile incluye arriba) usamos esa; si no, la
# cuenta cifrada 'deployer' del keystore de foundry.
#
# PRIVATE_KEY es la via rapida para el demo en testnet. Para algo con
# valor real usa el keystore o una hardware wallet: una llave en texto
# plano vive en el historial de tu shell y en el disco.
ifdef PRIVATE_KEY
SIGNER := --private-key $(PRIVATE_KEY)
else
SIGNER := --account deployer
endif

.DEFAULT_GOAL := help
.PHONY: help install build test test-ci test-all schedule gas coverage \
        fmt lint anvil web account balance key deploy-local deploy-hoodi \
        e2e e2e-ui clean

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; \
		       {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------
# El demo: dos comandos
# ---------------------------------------------------------------------

account: ## Crea la cuenta cifrada para desplegar (una sola vez)
	@mkdir -p ~/.foundry/keystores
	cast wallet new ~/.foundry/keystores deployer
	@echo ""
	@echo "Guardala bien. Ahora pedi ETH de Hoodi para esa direccion."

balance: key ## Direccion y saldo en Hoodi de la cuenta que firma
	@ADDR=$$(cast wallet address $(SIGNER)); \
	 echo "direccion : $$ADDR"; \
	 echo "saldo     : $$(cast balance $$ADDR --rpc-url hoodi --ether) ETH"

# Sin ## a proposito: es interno, no sale en `make help`. Falla antes de
# compilar para no hacerte esperar un build y recien ahi decirte que no
# hay con que firmar.
key:
	@cast wallet address $(SIGNER) >/dev/null 2>&1 || { \
	   echo "No hay con que firmar. Elegi una:"; \
	   echo ""; \
	   echo "  export PRIVATE_KEY=0x...   (rapido, para testnet)"; \
	   echo "  make account               (keystore cifrado)"; \
	   echo ""; \
	   exit 1; }

deploy-hoodi: key build ## Despliega todo en Hoodi (testnet) y deja el front listo
	forge script script/DeployDemo.s.sol:DeployDemo \
		--rpc-url hoodi $(SIGNER) --broadcast

web: ## Levanta el frontend contra lo ultimo que se desplego
	cd web && pnpm dev

deploy-local: build ## Lo mismo pero en anvil
	forge script script/DeployDemo.s.sol:DeployDemo \
		--rpc-url localhost --private-key $(ANVIL_PK) --broadcast

anvil: ## Levanta un nodo local
	anvil

# ---------------------------------------------------------------------
# Desarrollo
# ---------------------------------------------------------------------

install: ## Instala todas las dependencias (contratos y frontend)
	git submodule update --init --recursive
	forge build --force
	cd web && pnpm install && pnpm exec playwright install chromium

# --force a proposito: si editaste un contrato y despues corriste
# `forge lint`, forge deja el artefacto sin bytecode Y marca la cache
# como fresca, asi que un `forge build` normal no lo arregla y el
# despliegue falla con "No contract bytecode". Dos segundos de mas
# valen mas que ese error en vivo.
build: ## Compila los contratos (forzado, ver el comentario)
	forge build --force

test: ## Pruebas de los contratos: unitarias, fuzz e invariantes
	forge test -vv

test-ci: ## Igual que test pero con 10,000 corridas de fuzzing
	FOUNDRY_PROFILE=ci forge test -vv

test-all: test e2e ## Todo: contratos y end to end

e2e: build ## End to end: navegador real contra el frontend y anvil
	cd web && pnpm e2e

e2e-ui: build ## Lo mismo pero con la interfaz de Playwright
	cd web && pnpm e2e:ui

schedule: ## Imprime el calendario del stream
	forge test --match-test test_Schedule -vv

gas: ## Reporte de gas
	forge test --gas-report

coverage: ## Cobertura (corre en su propio perfil, ver foundry.toml)
	FOUNDRY_PROFILE=coverage forge coverage --report summary

fmt: ## Formatea los contratos
	forge fmt

lint: ## Linter de contratos y de frontend
	forge lint
	cd web && pnpm lint

clean: ## Borra artefactos de compilacion
	forge clean
	rm -rf web/dist web/test-results web/playwright-report
