export const SECTIONS = ['Languages', 'Platforms', 'Apps', 'Custom'] as const;

type Section = (typeof SECTIONS)[number];

export const GROUPS = {
  javascript: 'JavaScript',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  dotnet: '.NET',
  ruby: 'Ruby',
  php: 'PHP',
  haskell: 'Haskell',
  elixir: 'Elixir',
  dart: 'Dart',
  zig: 'Zig',
  cpp: 'C/C++',
  apple: 'Apple',
  containers: 'Containers',
  terraform: 'Terraform',
  macos: 'macOS',
  editors: 'Editors',
  gameEngines: 'Game engines',
  custom: 'Custom',
} as const;

const SECTION_OF: Record<string, Section> = {
  [GROUPS.javascript]: 'Languages',
  [GROUPS.python]: 'Languages',
  [GROUPS.rust]: 'Languages',
  [GROUPS.go]: 'Languages',
  [GROUPS.java]: 'Languages',
  [GROUPS.dotnet]: 'Languages',
  [GROUPS.ruby]: 'Languages',
  [GROUPS.php]: 'Languages',
  [GROUPS.haskell]: 'Languages',
  [GROUPS.elixir]: 'Languages',
  [GROUPS.dart]: 'Languages',
  [GROUPS.zig]: 'Languages',
  [GROUPS.cpp]: 'Languages',
  [GROUPS.apple]: 'Platforms',
  [GROUPS.containers]: 'Platforms',
  [GROUPS.terraform]: 'Platforms',
  [GROUPS.macos]: 'Platforms',
  [GROUPS.editors]: 'Apps',
  [GROUPS.gameEngines]: 'Apps',
};

export function sectionOf(group: string): Section {
  return SECTION_OF[group] ?? 'Custom';
}

export const GROUP_ORDER: string[] = Object.values(GROUPS);
