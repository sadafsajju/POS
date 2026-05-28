# UK Operations Guide

Reference for the UK rollout — covers data hosting, the regulatory features built into the POS, and the operational checklist the client should complete before go-live.

## 1. Data hosting

- **Backend**: Supabase Cloud. Production project should be created in **`eu-west-1` (London)** or **`eu-central-1` (Frankfurt)**.
- **Frontend**: Vercel. Deployment region follows project settings; CDN is global, but the bundle is static — no UK personal data sits on Vercel.
- **Why this matters**: UK GDPR (post-Brexit) doesn't strictly require EU residency, but the ICO recommends keeping data in-region unless a transfer mechanism is documented. Hosting in the EU avoids the question.

## 2. Backups & disaster recovery

- **Daily backups**: enabled by default on all Supabase projects (7-day retention on Free, 14 days on Pro).
- **Point-in-Time Recovery (PITR)**: enable in the Supabase dashboard → Settings → Database → Backups. Pro plan only. Restores to any second within the retention window.
- **What to do**: turn PITR on before go-live. Document the restore-test date — restore the production project to a staging branch quarterly to verify backups work.

## 3. Data Processing Agreement (DPA)

- Supabase publishes its DPA at <https://supabase.com/legal/dpa>.
- The client signs it electronically. The signed copy goes into their UK GDPR Article 30 records (record of processing activities).
- Vercel DPA is at <https://vercel.com/legal/dpa> — sign that one too if Vercel processes any personal data (it currently doesn't, but signing is cheap insurance).

## 4. Tax regime configuration

Settings → Financial → **Tax regime**. Two paths:

- **Flat tax** (default — used by Indian customers): single rate applied to subtotal.
- **UK VAT**: multi-rate with the eat-in/takeaway rule. When set:
  - Per-product **VAT category** (Standard / Reduced / Zero) and the **Hot food** flag determine the line-item rate.
  - Hot food and eat-in cold food are always standard-rated; cold takeaway uses the product's category (HMRC Notice 709/1).
  - **VAT registration number** must be set — it prints on every receipt.

## 5. VAT export (Making Tax Digital)

Admin → **VAT** (only visible when tax regime is UK VAT).

- Default period: current calendar quarter.
- Generates a CSV containing per-order VAT lines plus Box 1 (VAT due on sales) and Box 6 (total sales ex VAT).
- The client's accountant uploads the CSV into MTD bridging software (Tax Optimiser, VitalTax, ANNA, etc.) for submission.
- **This POS is not itself an HMRC-recognised MTD bridge** — it produces digital records, not direct submissions.

## 6. Allergen interlock (Natasha's Law / FIC Regs)

Settings → Financial → **Allergen surfacing & staff confirmation**. When on:

- The 14 statutory UK allergens are validated at the database level — products can only have known allergen codes.
- Staff must tap "Confirmed" in the dialog before any in-person order containing flagged allergens can be sent to the kitchen.
- The confirmation is timestamped and attributed to the staff user (audit trail).
- Pre-Packed for Direct Sale (PPDS) items uppercase their allergen names on receipts.

Set per-product allergens in **Products → edit**. Use `may_contain` for cross-contamination warnings.

## 7. GDPR / UK DPA data subject requests

Customer record → ⋯ menu:

- **Export data** — produces JSON with the customer record, all orders, and payments. Article 15 (right of access) and Article 20 (data portability).
- **Anonymise** — wipes PII (name, phone, email) but retains order history. Phone is replaced with a deterministic placeholder so a customer can't be re-linked, but order history stays for HMRC's 6-year retention rule. Article 17 (right to erasure) — partial.
- **Privacy policy URL** — set in Settings; printed on receipts and the cookie banner.
- **Customer retention policy** — Settings → optional months value; orders/customers older than this are flagged for review by `apply_retention_policy()`.

## 8. Tipping Act 2023

Settings → Financial → **Tipping**. When on:

- Tips can be recorded against orders and pooled.
- Admin → **Tips** lets a manager allocate the pool to staff (equal / hours-weighted / manual) and lock the allocation.
- The locked allocation is the audit record. Staff can read their own line; only managers can edit.
- **Tipping policy URL** — set in Settings; staff and customers should be able to read the policy.

## 9. Card payments

The POS **does not integrate with a payment service provider**. Card transactions are taken on a **standalone PED** (e.g., Dojo, SumUp, Worldpay terminal). The cashier:

1. Selects "Card" on the POS at payment time.
2. Charges the card on the PED separately.
3. POS records the method only — no PSP integration, no PAN, no card details ever touch this system.

This keeps the POS out of PCI DSS scope. End-of-day reconciliation (Admin → **Day-end**) compares POS card totals against the PED's settlement total — variances are recorded.

## 10. Day-end reconciliation

Admin → **Day-end**. Daily process:

1. Manager enters the PED settlement total and the cash drawer count.
2. POS computes card variance and cash variance against POS-side totals.
3. Notes field for any explanation.
4. Save — creates one immutable row per (org, location, date).

This is the audit trail HMRC asks for during inspections.

## 11. Calorie labelling (optional)

Settings → Financial → **Calorie labelling**. Mandatory in England for businesses with 250+ employees (Calorie Labelling Regs 2021). When on:

- Per-item kcal shows on menu, cart and receipts.
- Receipts print the statutory "Adults need around 2000 kcal a day" footnote.
- Set `calorie_count` on each product in Products → edit.

Smaller venues can leave this off.

## 12. Timezone

Settings → System → **Timezone**. Defaults to `Europe/London` for UK clients (auto-seeded for any org with `tax_regime = 'uk_vat'`).

- Drives every business-day boundary: order numbering, dashboard "today", EOD reconciliation, tip pool, sales/income reports, and VAT export.
- An order placed at 00:30 BST is correctly attributed to that day, not to "yesterday" in UTC.

## 13. Aggregator integration (Deliveroo / UberEats / JustEat)

Webhook handlers ship as **stubs** at `supabase/functions/aggregator-webhook/`. To enable a real platform:

1. Get developer credentials from the platform.
2. Update the corresponding handler in the edge function to parse that platform's payload format.
3. Set the platform's HMAC signing secret in Supabase secrets.
4. Configure the platform's webhook URL to point at `<project>.functions.supabase.co/aggregator-webhook?platform=<name>&restaurant_id=<uuid>`.

The router and HMAC verification are already in place; only payload parsing is platform-specific.

## 14. Pre-go-live checklist

Tick these off before the client takes their first order:

- [ ] Production Supabase project created in EU region.
- [ ] Migrations pushed; `tax_regime = 'uk_vat'` set.
- [ ] VAT registration number entered in Settings.
- [ ] Allergen interlock turned on; products have allergen data.
- [ ] Tipping policy decided; on/off set; URL added if on.
- [ ] Privacy policy URL added.
- [ ] PITR enabled on the Supabase project.
- [ ] DPA signed with Supabase (and Vercel).
- [ ] Restore-test run from a backup (proves backups actually work).
- [ ] Day-end reconciliation walked through with the manager.
- [ ] VAT export generated for a test period; accountant has a copy.
- [ ] PED chosen, settlement window agreed (T+1 typical).
- [ ] Support SLA written and signed.
- [ ] User accounts created with correct roles (admin / manager / counter / kitchen).
- [ ] Staff trained on the allergen confirmation flow.

## 15. Support

- **Severity 1** (POS down, can't take orders): aim 4-hour response.
- **Severity 2** (feature broken, workaround exists): 1 business day.
- **Severity 3** (cosmetic / enhancement): next release cycle.

Substitute the actual contact channel and hours in the signed agreement.

---

For implementation detail (database schema, RLS policies, RPC signatures), see [CLAUDE.md](CLAUDE.md) and the migration files under [supabase/migrations/](supabase/migrations/).
