# Jewellery billing + inventory (React + Vite + Firebase)

Simple multi-branch jewellery shop app.

- **One owner account** creates branches, adds stock, uploads stock from a CSV, prints labels, and sends
  stock to branches - all from the **Inventory** screen.
- **Branch staff** log in to their own branch: bill customers, see that branch's stock.
- **Old-bill offer:** a customer brings an old bill, staff scan its QR, and the new purchase gets
  **50% off**. Each old bill works **once**; after that it is expired. It works at **any branch**.

## Try it now (no Firebase needed)

```bash
npm install
npm run demo
```

Opens http://localhost:5190 with a sample shop (2 branches, stock, 3 bills). Password for every demo
user is `demo123`: `owner@demo.com`, `staff@demo.com` (Nagpur Main), `staff2@demo.com` (Wardha).
Try scanning bill `NGP01-INV-000002` (unused, gives 50%) and `NGP01-INV-000001` (already used, expired).
Demo data lives in memory and resets on refresh, but runs the same service code as production.

## Go live on Firebase

1. Firebase console → create a project.
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → create it.
4. Project settings → *Your apps* → add a **Web** app → copy the config into `.env` (`cp .env.example .env`).
5. Deploy:
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes
   npm run build && firebase deploy --only hosting
   ```
6. Open the site. The first visit shows a **one-time setup** (owner account, shop name, first branch).
   Do this straight after deploying. Then add more branches under **Branches** and staff under **Staff**.

## How the owner works

| I want to… | Where |
|---|---|
| Create a branch | Branches → Add branch (its code becomes the bill prefix, e.g. `NGP02-INV-000001`) |
| Add one product (or N identical pieces) | Inventory → **Add product** |
| Upload many products | Inventory → **Upload CSV** (file, or paste rows copied from Excel). Preview shows bad rows before anything is saved. Use the *branch* column to put rows in different branches. |
| Print labels | Tick pieces in Inventory → **Print labels** (QR = Product ID, name, weight, price; 3 across on A4). Newly added pieces are pre-selected. |
| Send stock to a branch | Tick pieces → **Move to branch**. Immediate; no approvals or receiving steps. |
| Add a branch login | Staff → Add staff |
| Change offer % or GST | Settings |
| Cancel a bill | Bills → open it → Cancel (reason needed). Stock returns; an old bill used for the offer becomes valid again. |

Upload columns: `name`, `price` (required); `category, metal, purity, gross_weight, net_weight, huid, branch, qty`.

## The old-bill offer rules

- An old bill is valid if it is **not cancelled** and its offer is **not used yet**.
- Confirming the new bill **expires** the old one in the same transaction, so two counters cannot use
  the same old bill at the same time (one wins, the other is told it has expired).
- A bill that was itself bought with the offer cannot give another offer (stops endless 50% chains).
  Tell me if you want that changed.
- The customer's QR page shows whether the offer is still available or already used.

## How reliability is achieved

- A bill is **one Firestore transaction**: bill + QR record + stock status + history + (old bill expiry).
  If anything fails nothing is written.
- Bill number = document ID and rules make bills create-only, so numbers never repeat.
- Bills, history and the activity log are never edited or deleted; cancelling is an audited reversal.
- **Firestore security rules** decide who can do what (staff cannot add stock, move stock, edit prices,
  cancel bills or read the activity log), even if someone bypasses the screens.

`npm test` runs 28 checks: CSV parsing, adding/distributing stock, billing, the old-bill offer
(any branch, once only, race between two counters, cancelled/used bills), cancelling, permissions,
and rollback when a write fails.

## Read this before relying on it

- **Not yet run against a live Firebase project.** The business logic is verified against an
  in-memory Firestore and in demo mode, but **`firestore.rules` has not been executed**: test it with
  the Firebase emulator or a staging project before real data.
- Checks run in the browser and rules back them up. Rules cannot recompute totals, so a determined
  staff member with dev-tools could craft a self-consistent bad write. For hard guarantees move
  `completeSale` / `cancelInvoice` into Cloud Functions (Blaze plan).
- Any staff member can read any bill by its number (needed so an old bill works at every branch).
- Not built: WhatsApp bills, camera QR scanning (USB/Bluetooth scanners work: they type the ID),
  `.xlsx` upload (save as CSV or paste from Excel), purchase/supplier/cost tracking, wholesale/credit.

## Layout

```
src/lib        bill maths (calc), old-bill check (offer), CSV parser, permissions
src/services   all Firestore transactions (sales, stock, customers, admin)
src/pages      screens          src/components  shared UI (labels, upload, pickers)
src/demo       in-memory Firebase + sample data for `npm run demo` and tests
firestore.rules  security rules      firestore.indexes.json  one composite index
```
