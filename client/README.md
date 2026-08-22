# QA Test Management Tool — client

React SPA (Vite) for the QA Test Management Tool. See the [project root README](../README.md) for what this app does and how to run the full stack.

## Local development

```bash
npm install
npm run dev       # http://localhost:5173, proxies /api to http://localhost:4000
```

Start the [server](../server) first — the dev proxy (`vite.config.js`) forwards `/api/*` to it.

```bash
npm run build       # production build → dist/
npm run preview      # serve that build locally
npm run lint          # oxlint
```

## Structure

| Folder | Contents |
|---|---|
| `src/api/` | One fetch module per backend resource |
| `src/components/` | Shared UI (modals, badges, nav, tag picker...) |
| `src/context/` | Active user (`UsuarioContext`) and active project (`ProyectoContext`) |
| `src/screens/` | One folder per screen: Dashboard, CasosPrueba, FasesTesting, EjecucionCiclo, Resultados |
| `src/styles/` | Design tokens (`tokens.css`) + global styles |

Full architecture, API reference, and data model docs live in [`/docs`](../docs) at the repo root.
