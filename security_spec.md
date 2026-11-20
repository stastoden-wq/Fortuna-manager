# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every club workspace document lives under `/users/{userId}/...` and MUST satisfy `request.auth.uid == userId`, `request.auth.token.email_verified == true`, and `data.ownerId == request.auth.uid`.
2. **Zero Cross-Tenant Reads/Lists**: Every `allow get` and `allow list` verifies `isVerifiedOwner(userId)` AND for `list` explicitly asserts `resource.data.ownerId == request.auth.uid`.
3. **Strict Key & Size Enforcement**: Every `create` checks `hasAll([...]) && hasOnly([...])`; every `update` wraps `isValid*` AND `affectedKeys().hasOnly([...])`; every string and array has explicit `.size()` bounds.
4. **Immutability & Temporal Integrity**: `ownerId` and `createdAt` are immutable after creation (`incoming().ownerId == existing().ownerId`, `incoming().createdAt == existing().createdAt`); `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
5. **Path ID Hardening**: All single-document operations (`get`, `create`, `update`, `delete`) validate document IDs via `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read**: `GET /users/uidA/players/p1` with `auth = null`.
2. **Unverified email write**: `CREATE /users/uidA/players/p1` with `auth.uid = uidA`, `email_verified = false`.
3. **Cross-user read**: `GET /users/uidA/matches/m1` with `auth.uid = uidB`.
4. **Cross-user list scraping**: `LIST /users/uidA/players` with `auth.uid = uidB`.
5. **Identity spoofing on create**: `CREATE /users/uidA/players/p1` with `ownerId: "uidB"`.
6. **Owner hijack on update**: `UPDATE /users/uidA/players/p1` attempting to mutate `ownerId` to `"uidB"`.
7. **Shadow / ghost field injection**: `CREATE` or `UPDATE /users/uidA/players/p1` with extra key `isAdmin: true`.
8. **Client-forged timestamp**: `CREATE /users/uidA/seasons/s1` with `createdAt` not equal to `request.time`.
9. **Immutable createdAt mutation**: `UPDATE /users/uidA/seasons/s1` changing `createdAt`.
10. **ID poisoning (Denial of Wallet)**: `CREATE /users/uidA/players/<200-char-invalid-id>` with spaces/slashes.
11. **Oversized array / string poisoning**: `CREATE /users/uidA/matches/m1` with `events.size() == 200` or `name.size() == 5000`.
12. **Value poisoning on whitelisted key**: `UPDATE /users/uidA/players/p1` setting `number: "hack"` or `role: "SUPERADMIN"`.
