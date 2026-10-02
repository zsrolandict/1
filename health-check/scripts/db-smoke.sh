#!/usr/bin/env bash
# Migrációk + füsttesztek üres PostgreSQL-adatbázison (Supabase `auth` stubbal).
#   PGDATABASE=hc_test scripts/db-smoke.sh      (a psql szokásos PG* változóit használja)
set -euo pipefail
cd "$(dirname "$0")/.."
M=supabase/migrations
T=supabase/tests
files=(
  "$T/00_auth_stub.sql"
  "$M/0001_init.sql" "$M/0002_interviews_and_kinds.sql" "$T/01_rls_smoke.sql"
  "$M/0003_valuation_and_reasoning.sql" "$T/02_interviews_smoke.sql" "$T/03_valuation_smoke.sql"
  "$M/0004_materiality_expected_loss.sql" "$T/04_materiality_smoke.sql"
  "$M/0005_intake.sql" "$T/05_intake_smoke.sql"
  "$M/0006_case_profile_requests.sql" "$T/06_requests_smoke.sql"
  "$M/0007_sectors_overview.sql" "$M/0008_snapshots.sql" "$M/0009_registry_benchmark_timesheet.sql" "$T/07_benchmark_smoke.sql"
  "$M/0010_evidence_financials.sql" "$T/08_evidence_financials_smoke.sql"
  "$M/0011_discussion.sql" "$T/09_discussion_smoke.sql"
  "$M/0012_remediation_plan.sql" "$T/10_remediation_plan_smoke.sql"
  "$M/0013_kind_adjustments_rag.sql" "$T/11_rag_parity.sql"
  "$M/0014_server_trust.sql" "$T/12_server_trust_smoke.sql"
)
# Minden migráció benne van-e a listában? (új migrációnál ne maradjon ki)
for m in "$M"/*.sql; do
  printf '%s\n' "${files[@]}" | grep -qx "$m" || { echo "Hiányzik a listából: $m" >&2; exit 1; }
done
args=()
for f in "${files[@]}"; do
  args+=(-f "$f")
  # A füsttesztek szerepkört és munkamenet-változókat állítanak: a következő fájl előtt vissza.
  [[ "$f" == "$T"/* ]] && args+=(-c "reset role; reset all;")
done
psql -v ON_ERROR_STOP=1 -q "${args[@]}"
echo "Migrációk és füsttesztek rendben (${#files[@]} fájl)."
