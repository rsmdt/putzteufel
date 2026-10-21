export const brew = (bin: string, formula = bin) => ({ bin, install: `brew install ${formula}`, uninstall: `brew uninstall ${formula}` });

export const docker = (list: string) => `if docker info >/dev/null 2>&1; then ${list}; fi`;
