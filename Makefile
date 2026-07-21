MARKETPLACE := agent-auditor-local
PLUGIN      := agent-auditor
PLUGIN_ID   := $(PLUGIN)@$(MARKETPLACE)
ROOT        := $(CURDIR)

.PHONY: help build install uninstall reinstall status

help:
	@echo "make build      - install deps and compile TypeScript"
	@echo "make install    - register this directory as a marketplace and install the plugin"
	@echo "make uninstall  - uninstall the plugin and remove the marketplace"
	@echo "make reinstall  - uninstall, then install again from this directory"
	@echo "make status     - show installed plugins and configured marketplaces"

build:
	pnpm install
	pnpm build

install:
	claude plugin marketplace add $(ROOT) || claude plugin marketplace update $(MARKETPLACE)
	claude plugin install $(PLUGIN_ID) --scope user
	@echo "Installed $(PLUGIN_ID). Restart Claude Code to load it."

uninstall:
	-claude plugin uninstall $(PLUGIN_ID) --scope user --yes
	-claude plugin marketplace remove $(MARKETPLACE)
	@echo "Removed $(PLUGIN_ID)."

reinstall: uninstall install

status:
	claude plugin list
	claude plugin marketplace list
