import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Elixir',
  group: GROUPS.elixir,
  projects: [{ name: 'Build and deps', markers: ['mix.exs'], dirs: ['_build', 'deps', '.elixir-tools', '.elixir_ls', '.lexical'], description: 'Recreated by mix deps.get and mix compile.' }],
});
