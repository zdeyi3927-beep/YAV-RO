# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Owner & Admin Isolation (PII Protection)**: Worker documents contain PII (phone number, national ID, NSSF number, DOB, residential address). Read (`get`, `list`) and write access to `/workers/{workerId}`, `/contracts/{contractId}`, and `/tasks/{taskId}` is strictly scoped to `resource.data.ownerId == request.auth.uid` or verified admin (`request.auth.token.email_verified == true && request.auth.token.email == 'zdeyi3927@gmail.com'`).
2. **Contract Relational Integrity**: A contract cannot exist without an existing parent worker in `/workers/{workerId}` owned by the same `ownerId`. Contract duration is strictly coupled to `contractType` (`probation_60` -> `60`, `fulltime_90` -> `90`).
3. **Task Relational Integrity**: If a task specifies a non-empty `workerId`, that worker must exist in `/workers/{workerId}` and belong to the same `ownerId`.
4. **Immutable Ownership & Temporal Integrity**: `ownerId` and `createdAt` cannot be modified after creation. `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
5. **Terminal State Locking**: Contracts in `superseded` or `terminated` state and Tasks in `archived` state cannot be mutated by non-admin users.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Read/Write**: Read or write `/workers/w1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Create**: User A attempts to create `/workers/w1` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
3. **Cross-Tenant PII Read/List**: User B attempts `get` or `list` on `/workers` where `ownerId == "userA"` -> `PERMISSION_DENIED`.
4. **Unverified Email Admin Spoof**: Attacker signs in with `email: "zdeyi3927@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Create**: Create `/workers/w1` with extra ghost field `isVerified: true` -> `PERMISSION_DENIED`.
6. **Shadow Update on Update**: Update `/workers/w1` with extra field `role: "admin"` -> `PERMISSION_DENIED`.
7. **Resource Poisoning (1MB ID / Oversized String)**: Create `/workers/<200-char-id>` or `khmerName` with 2000 characters -> `PERMISSION_DENIED`.
8. **Invalid Contract Duration Mismatch**: Create `/contracts/c1` with `contractType: "probation_60"` and `durationDays: 90` -> `PERMISSION_DENIED`.
9. **Orphaned Contract Write**: Create `/contracts/c1` referencing non-existent `workerId: "missing_worker"` -> `PERMISSION_DENIED`.
10. **Client-Spoofed Timestamp**: Create `/tasks/t1` with `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Terminal State Bypass**: Non-admin attempts to update `/contracts/c1` whose existing status is `"superseded"` or `"terminated"` -> `PERMISSION_DENIED`.
12. **Owner Reassignment Attack**: User A attempts to update `/tasks/t1` changing `ownerId` from `"userA"` to `"userB"` -> `PERMISSION_DENIED`.
