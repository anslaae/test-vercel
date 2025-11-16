# Vite + React Template

This is a template for [Vite](https://vitejs.dev/) + [React](https://reactjs.org/) projects.

## Features

- Vite 4.x
- React 18.x
- JSX
- TypeScript
- ESLint
- Prettier
- Vitest

## Clone to Local

```bash
git clone https://github.com/your-username/vite-react-template.git
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Vercel Routing (Updated)
The project uses `vercel.json` with `routes` for SPA fallback:

```jsonc
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
```

This ensures direct navigation to client routes like `/login` does not 404 and is not an HTTP redirect; Vercel serves `index.html` directly after first checking for real files/functions.
