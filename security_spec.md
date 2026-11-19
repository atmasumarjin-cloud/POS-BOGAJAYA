# Security Specification — BOGAJAYA POS & Accurate ERP

## 1. Data Invariants
1. Every document in `pos_products`, `pos_transactions`, `pos_customers`, `pos_journals`, `pos_stock_movements`, and `pos_settings` MUST carry an immutable `ownerUid` matching `request.auth.uid` (unless operated by a verified admin).
2. All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. Every `createdAt` and `updatedAt` timestamp MUST equal `request.time` on creation, and `createdAt` is immutable on updates (`incoming().createdAt == existing().createdAt`).
4. `pos_transactions` in terminal state (`status == 'voided'`) cannot be mutated back to `'completed'` by standard users.
5. `pos_customers` PII (`phone`, `email`, `address`) is strictly isolated to the owning `ownerUid` or verified admin; no blanket `isSignedIn()` list/get access is permitted.
6. All document IDs are validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars), and all string fields enforce explicit `.size()` bounds.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` reading `pos_customers/cust-1` -> DENIED.
2. **Unverified Email Write**: `request.auth.token.email_verified == false` creating `pos_transactions/tx-1` -> DENIED.
3. **Cross-Tenant Ownership Spoof**: User A (`uid: 'u1'`) creating `pos_transactions/tx-2` with `ownerUid: 'u2'` -> DENIED.
4. **Shadow Field Injection**: Creating `pos_customers/cust-2` with extra field `isAdmin: true` -> DENIED by `keys().hasOnly(...)`.
5. **Blanket List Scraping**: Listing `pos_customers` without filtering by `ownerUid == request.auth.uid` -> DENIED by `resource.data.ownerUid == request.auth.uid`.
6. **ID Poisoning**: Creating `pos_products/` with 500-char ID or invalid characters `../admin` -> DENIED by `isValidId()`.
7. **Timestamp Forgery**: Creating `pos_journals/j-1` with backdated `createdAt` != `request.time` -> DENIED.
8. **Immutable Field Tampering**: Updating `pos_transactions/tx-1` to change `ownerUid` or `createdAt` -> DENIED.
9. **Terminal State Resurrection**: Updating a `status: 'voided'` transaction back to `status: 'completed'` -> DENIED.
10. **Negative Price/Quantity Injection**: Creating `pos_products/p-1` with `price: -5000` or `stockPusat: -10` -> DENIED.
11. **Oversized Description Payload (DoW)**: Creating `pos_products/p-2` with `name` length 5000 chars -> DENIED.
12. **Privilege Escalation on Settings**: Updating `pos_settings/u1` with non-whitelisted fields -> DENIED by `affectedKeys().hasOnly(...)`.
