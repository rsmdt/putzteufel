import { GROUPS } from '../core/index.ts';
import { definePlugin } from '../engine/define.ts';

export default definePlugin({
  name: 'Python',
  group: GROUPS.python,
  projects: [
    { name: 'Caches', dirs: ['__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.pytype', '.hypothesis', '.tox', '.nox', '__pypackages__', '.ipynb_checkpoints'], impact: 'regenerates', description: 'Bytecode and test/lint caches, rewritten on the next run.' },
    { name: 'Virtual environment', contains: ['pyvenv.cfg'], description: 'Recreate with uv sync, poetry install or pip install -r requirements.txt. Anything installed by hand is lost.' },
    { name: 'Build output', markers: ['pyproject.toml', 'setup.py', 'setup.cfg'], dirs: ['build', 'dist', '*.egg-info', '.eggs', 'htmlcov'], impact: 'unknown', description: 'Wheels and build trees. Recreated by a build, but a dist/ you meant to publish is gone.' },
  ],
});
