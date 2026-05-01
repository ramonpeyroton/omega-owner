// Default disclaimer text shown on every estimate the customer signs.
// The seller can edit this per-estimate from EstimateBuilder. Whatever
// text the customer actually saw is snapshotted on `estimates.disclaimers`
// at sign time so a future edit to this default can never change the
// legal record of what someone agreed to.
//
// Updated 2026-05-01 to the formal "Terms, Conditions & Disclaimer"
// language Inácio + counsel approved. Replaces the older field-checklist
// phrasing. The CT Truth-In-Lending three-day cancellation notice
// (CGS § 42-135a) is preserved verbatim under section 12.

export const DEFAULT_ESTIMATE_DISCLAIMERS = `**TERMS, CONDITIONS & DISCLAIMER**

**1. Third-Party Services (Surveyors, Engineers, etc.)**

Omega Development LLC may, at the Client's request, assist in coordinating third-party professionals, including but not limited to surveyors and engineers. However, Omega Development LLC assumes no responsibility or liability for the performance, accuracy, scheduling, delays, or costs associated with such third-party services. Any disputes or issues arising from these services shall be resolved solely between the Client and the third-party provider.

**2. Estimate Validity**

All estimates provided are valid for a period of fifteen (15) calendar days from the date issued. After this period, Omega Development LLC reserves the right to revise pricing.

**3. Deposits & Scheduling**

A deposit is required to secure scheduling and commencement of work. Work will not be scheduled or initiated until the deposit has been received and cleared.

**4. Scope of Work & Change Orders**

This estimate is based solely on the scope of work expressly described herein. Any additional work, modifications, or unforeseen conditions not included in the original scope shall require a written change order. All change orders will incur additional costs and must be approved and paid in full prior to the execution of such work.

**5. Tile Installation Standards**

Tile installation pricing is based on standard patterns, including horizontal offset, square set, or brick pattern. Any specialty or custom patterns (including but not limited to herringbone, diagonal layouts, or mosaics) will be considered additional work and priced accordingly.

**6. Demolition & Concealed Conditions**

Client acknowledges that demolition and construction activities may reveal or cause damage to concealed or adjacent areas, including but not limited to walls, ceilings, flooring, plumbing, and electrical systems. Omega Development LLC is not responsible for pre-existing conditions or incidental damage resulting from necessary demolition. Repairs to such areas are not included unless specifically stated and will be subject to additional charges.

**7. Site Access & Obstructions**

If removal or alteration of existing structures (including but not limited to fences, sidewalks, landscaping, or stone walls) is required to facilitate access for equipment or materials, such work and subsequent restoration are not included in this estimate and will be billed as additional work upon Client approval.

**8. Permits & Fees**

Client is solely responsible for all permitting costs, application fees, and related expenses unless otherwise agreed in writing. Omega Development LLC may assist in the permitting process; however, no responsibility is assumed for delays or outcomes related to permit approvals or certificate of completion.

**9. Payment Processing Fees**

Payments made by credit card may be subject to a processing fee not to exceed the actual cost of processing the transaction or the maximum amount permitted by applicable law and card network rules. This fee will be disclosed to the Client prior to processing payment. No surcharge will be applied to debit card payments. Alternative payment methods, including ACH, wire transfer, or Zelle, are not subject to processing fees.

**10. Exclusions**

Unless explicitly stated in this agreement, Omega Development LLC does not provide or install appliances.

**11. Limitation of Liability**

To the fullest extent permitted by law, Omega Development LLC shall not be liable for any indirect, incidental, consequential, or special damages, including but not limited to loss of use, loss of value, or delays beyond its reasonable control.

**12. Cancellation Rights**

YOU MAY CANCEL THIS TRANSACTION WITHOUT PENALTY OR OBLIGATION WITHIN THREE (3) BUSINESS DAYS FROM THE DATE OF ACCEPTANCE.

If cancelled within this period, all payments made will be refunded in accordance with applicable law, and any security interest arising from the transaction will be cancelled.

To cancel, the Client must provide written notice to:

Omega Development LLC
278 Post Road East, 2nd Floor
Westport, CT 06880

Notice must be delivered or postmarked no later than midnight of the third (3rd) business day following acceptance.

**13. Acceptance of Terms**

By signing this document, the Client acknowledges that they have read, understood, and agree to all terms, conditions, and provisions outlined herein.`;
