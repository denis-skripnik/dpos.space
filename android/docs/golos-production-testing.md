# GOLOS repair verification

ProductionPolicyTest covers the sole automatic endpoint. ProductionMigrationTest uses the default policy and concrete HTTP client's actual hashed scope, with loopback transport. ProductionContractTest covers exact migration, authority failures, restart, immutable evidence, bounds, consent and intake preservation. ProductionExecutionTest uses real Kotlin runtime/store/signing with intercepted loopback sends. ContentDegradedTest covers typed failures and all-50-unavailable reporting.

LegacyTestGolosPolicy is only an explicit admission stub for older tests of unrelated runtime behavior; new contract tests use the real policy. No production flag disables admission. Production endpoint policy is not a network-wide cryptographic fork-choice proof: trust is the public golos.id product configuration and reviewed irreversible bot block.

GolosProductionAndroidTest is prepared but NOT executed. On an approved disposable Android device, run its A and B phases with one unique runId in separate instrumentation processes. It checks physical transition durability only; all RPC/sign/send methods throw. It does not establish device execution of the complete new branch flow, TalkBack, or live transactions. Parent must obtain real Android acceptance separately. Never start an emulator on the main Hermes host or buy a host without approval.
