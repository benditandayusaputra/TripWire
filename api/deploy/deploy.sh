#!/bin/sh
set -eu

cd /opt/tripwire
exec 9>deploy.lock
flock 9

mkdir -p releases
masuk=$(mktemp -d releases/.masuk-XXXXXX)
tar -xz -C "$masuk"
rev=$(cat "$masuk/REVISION")
rm -rf "releases/$rev"
mv "$masuk" "releases/$rev"
chmod 755 "releases/$rev"
echo "deploy $rev"

sebelumnya=$(readlink current 2>/dev/null || true)

gagal() {
	echo "deploy $rev gagal, kembali ke ${sebelumnya:-kosong}"
	if [ -n "$sebelumnya" ]; then
		ln -sfn "$sebelumnya" current
		docker compose up -d --force-recreate tripwire-api tripwire-scheduler
	fi
	exit 1
}

ln -sfn "releases/$rev" current
docker compose run --rm --entrypoint /app/bin/migrate tripwire-api up || gagal
docker compose up -d --force-recreate tripwire-api tripwire-scheduler || gagal

sehat=""
for _ in $(seq 30); do
	if curl -fs http://127.0.0.1:8090/health >/dev/null; then sehat=1; break; fi
	sleep 2
done
[ -n "$sehat" ] || gagal

ls -1t releases | tail -n +4 | while read -r lama; do rm -rf "releases/$lama"; done
echo "deploy $rev selesai"
