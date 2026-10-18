# GOLOS production repair

Baseline: 1f4bb3be0f75fb487064b48c90c861321e1ea2ed. Isolated branch: repair/golos-production-20261017. No web changes, production writes, mainnet transactions, deployment, delivery or paid host.

Frozen-contract mapping:
- Branch: GolosProductionPolicy, sole api-full.golos.id, reviewed checkpoint and real hashed transport scope. Checkpoint is not a recovery fence.
- Exact exception: WorkerStore.migrateReviewedGolosFence, under runner ownership before all reconciliation.
- Durability: TransactionCheckpointStore, immutable transition, exact old fence, observed unverified new epoch, monotonic drain, no restart recapture.
- Adoption/generation: unchanged GolosRecoveryFence strict drain, ancestry, LIB, revision and future-root guards.
- Old evidence: original-fence validation, foreign vote/donation quarantine, no replay, settlement or catch-up.
- Intake: independent epoch keys and actual endpoint/API scopes. Old inbox/cursors remain retained, not cleared or acknowledged.
- Diagnostics: GolosContentStatus and account-scoped degraded status with three bounded public samples.

Use android/scripts/run_tests.sh for actual Gradle gates, never pytest. Host Robolectric/loopback evidence is not device acceptance. Parent independent review is required before delivery.
