# La Brasa - Polyglot Restaurant Platform

Four-container restaurant ordering platform: React/nginx, NestJS, MongoDB replica set, and Cassandra projections.

## Coolify Deployment

1. Create a Docker Compose resource from this repository.
2. Set the Compose file location to `/infra/compose.yaml`.
3. Add the variables from `.env.example` in Coolify and replace the operator credentials and JWT secret.
4. Deploy the resource. Coolify routes the `web` service on port 80 to `https://restaurante.cloud.groowtech.com`.
5. Point the DNS `A`/`AAAA` record for `restaurante.cloud.groowtech.com` to the Coolify server.

The API is available through `/api` on the same domain. The API, MongoDB, and Cassandra have no published host ports. MongoDB and Cassandra data persist in the `mongodb_data` and `cassandra_data` named volumes.

Coolify must define `OPERATOR_PASSWORD_HASH_B64`; remove any old `OPERATOR_PASSWORD_HASH` variable because raw bcrypt `$` characters are interpreted by Docker Compose.

Generate production values before deployment:

```powershell
pnpm --filter @app/api exec node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then((hash) => console.log(Buffer.from(hash).toString('base64')))" "YOUR_PASSWORD"
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Store the encoded hash in `OPERATOR_PASSWORD_HASH_B64`. The API decodes it in memory before bcrypt verification, avoiding Docker Compose `$` interpolation. The plain password is used only to sign in. Never commit production values.

## Local Test Stack

The ignored `.env.test` file contains disposable credentials for local verification:

- Username: `operator-test`
- Password: `BrasaTest2026!`
- URL: `http://127.0.0.1:18080`

```powershell
docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml -f infra/compose.local.yaml up -d --build --wait
docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml ps
docker compose --project-directory . --env-file .env.test -p restaurant -f infra/compose.yaml down
```

The final command preserves database volumes. Add `--volumes` only when intentionally deleting all local data.
