# Gcloud

## Metadata file clean up

There is a bug where a bunch of `*.metadata.metadata.metadata...` files build up in the local buckets. You can clean up with the following command.

```bash
cd data/kevbot-local-audio
find . -type f -name '*.metadata' -delete
```
