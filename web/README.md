# Filla IQ Web

Next.js 16 web dashboard for Filla IQ. See the root [README](../README.md) for project overview.

## Development

```bash
cp .env.example .env.local  # Configure database URL and auth secrets
npm install
npm run dev                  # http://localhost:3000
```

## Database

```bash
npx drizzle-kit generate     # Generate migration from schema changes
npx drizzle-kit migrate      # Apply pending migrations
npx drizzle-kit push         # Push schema directly (dev only)
```

## Deployment

Deployed to AKS (Azure Kubernetes Service) via Helm. Push to `main` triggers the GitHub Actions workflow which builds an ARM64 Docker image, pushes to GHCR, and deploys via `helm upgrade`.

See `packages/infrastructure/helm/` for the Helm chart and `../.github/workflows/deploy.yml` for the CI/CD pipeline.
