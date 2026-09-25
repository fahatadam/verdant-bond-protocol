# Coupon Accounting Invariants

The Verdant Bond Protocol enforces strict conservation of carbon credits across the coupon lifecycle. Credits are derived from verified oracle reports and are distributed to bond holders. The accounting guarantees that no credits are magically created, lost in transit, or claimed multiple times.

## Conservation Rule

At any point in the lifecycle, the following equation must hold exactly:

`Total Sequestered = Total Claimed + Total Accrued (Unclaimed) + Undistributed + Total Swept`

Where:
- **Total Sequestered**: The total `carbon_sequestered` amount from all verified oracle reports that have been processed for a bond.
- **Total Claimed**: The sum of all credits successfully claimed and retired by bondholders via the `CreditRetirement` contract.
- **Total Accrued**: The sum of all credits allocated to bondholder balances in the `CouponEngine` but not yet claimed.
- **Undistributed**: The pool of credits in the `CouponEngine` that have not yet been distributed (either from a newly processed report, or left over due to fractional rounding / unallocated supply).
- **Total Swept**: Leftover dust and undistributed credits that the admin has recovered via `sweep_undistributed`.

## Lifecycle Invariants

1. **Distribution**: When `distribute_coupon` runs, it pulls from `Undistributed` and adds to each holder's `Accrued` balance proportional to their bond holdings. The sum of all additions plus any remainder (due to rounding) precisely equals the amount deducted from `Undistributed`.
2. **Claiming**: When a holder claims credits via `retire_credits`, their `Accrued` balance in the `CouponEngine` is reduced by exactly the claimed amount (`CreditRetirement` invokes `CouponEngine.consume_credits` under the holder's authorization before it mints the certificate), and the `CreditRetirement` contract records the retirement. A holder can never claim more than their accrued balance, and credits retired this way are no longer claimable through `claim_credits`. Duplicate claims fail deterministically.
3. **Sweeping**: `sweep_undistributed` allows the admin to recover any `Undistributed` credits. Once swept, these credits are removed from the `Undistributed` pool. Sweeping does not affect already `Accrued` balances; holders can still claim what they are owed. Post-sweep claims function normally for accrued balances.
4. **Maturity**: After bond maturity, the fundamental conservation rule still holds. Late claims are permitted against previously accrued balances.

These rules are verified on-chain and through cross-contract integration tests ensuring no edge case (such as zero-balance holders, partial distributions, or precision loss) can break the accounting. The executable form of each rule, and the generators used to search for counterexamples, are described in coupon-math-invariants.md.
