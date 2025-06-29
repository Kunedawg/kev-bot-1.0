# README for developers

## Running locally

1. Make sure you have docker installed
2. Obtain an `audio.zip` of audio files and a database `dump.sql` that are compatible with each other.
3. Unzip `audio.zip` files to `gloud/data/kevbot-local-audio` directory
4. Put the `dump.sql` into the `db/migration/seeds/` directory. Note make sure you are aware of what schema version the dump is compatible with.
5. Create a symlink `.env` at root of directory to a valid environment variable file like `local_dev.env`

   ```sh
   ln -s local_dev.env .env
   ```

6. Start local versions of the `db` and `gcloud` storage by running:

   ```sh
   docker compose --env-file .env -f docker-compose.dev.yml up [-d]
   ```

7. migrate the database

```bash
cd tools/db/migration_manager
docker build -t migration-manager1 .
cd /
docker run --rm --env-file .env -v ./db/migration:/app/migration migration-manager1 migrate migration
```

8.
