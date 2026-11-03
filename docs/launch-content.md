# Launch content: what the code shows, and what the owner or a lawyer must supply

Written by the launch-content pass. No policy text was written by code or by Claude.

## 1. Policy pages Razorpay asks for before live payments

| Page | Exists? | Where it is linked | Status |
|---|---|---|---|
| Privacy Policy `/privacy-policy` | yes (admin: Privacy Policy) | footer, **checkout next to Pay**, **sign-up form** | **Not saved in the database.** The live page shows the generic default text that is in the code (`src/lib/legal-pages.ts`). A lawyer/owner must write and save the real text in the admin. |
| Terms & Conditions `/terms-and-conditions` | yes (admin: Terms & Conditions) | footer, checkout, sign-up | **Not saved in the database**, same as above. The default says only "Delivery times are estimates" and states no return window. |
| Refund / Cancellation / Returns policy | **missing** | nowhere | Needed by Razorpay. The legal-page editor only supports the two pages above, so this needs a small follow-up (a third page type in the same editor) AND the text. |
| Shipping / Delivery policy | **missing** | nowhere | Same. |
| Contact page `/contact` | yes | footer ("Contact Us"), navbar | The saved address is still the placeholder `123 Forest Lane, Nature Valley, Earth 456789`. Phone, e-mail and hours are saved (check they are real). |

What the owner/lawyer must supply: the four policy texts (privacy, terms, refunds/cancellations/returns, shipping), including the return/exchange window and conditions; the refund timeline and method; which shipping charges and free-shipping threshold apply (these come from Admin > Pricing: today shipping ₹99, free above ₹399); delivery times; a real business address, phone and e-mail on the contact page; the seller's legal/business name and GST details if Razorpay asks for them.

Contradictions between the UI and the rules, found and removed: the cart said "Free returns within 30 days" and "Carbon-neutral delivery" (no policy states either); checkout said "PCI DSS compliant payment processing" (that is Razorpay's certification, not the shop's); the order-confirmation page promised "5-7 business days"; the product page promised "3-5 business days" for every product by default; the trust strip on the live site says "Free shipping, Above ₹699" while checkout gives free shipping above ₹399 (the strip now takes the figure from the pricing setting).

## 2. Saved content that still matches placeholder wording
Run `node scripts/find-placeholder-content.mjs` (read-only). These were saved when the old code wrote its defaults into the database on the first settings save. They are NOT changed by this work (no migration); review them in the admin:
- Homepage > Hero: subtitle "Summer 2026 Collection", title "Born from the forest, / made for the wild.", description "Slow-made forest gear...", badge subtext "Eco materials" (the badge is currently switched off).
- Homepage > Eco commitment: "Our commitment", "Every order shapes a gentler ...", and one item "1% Revenue donated" (an unverifiable claim).
- Homepage > Brand story: subtitle "OUR ROOTS".
- Contact: the address; the subtitle "We would love to hear from you..."; hours "Mon-Fri, 9:00 AM - 6:00 PM".
- 13 of 14 products carry the old default shipping text "3-5 business days" / "1-2 business days".

## 3. Needs owner confirmation (not guessed, not changed)
- Footer chip **"Made in India"**: a claim about where goods are made.
- Blog index header copy "Indian Mist Journal / From the Trail ... exploring the outdoors responsibly".
- Collections page intro "Discover items grouped by causes and themes. Thoughtfully put together for your journey."
- Checkout "We accept: UPI, Cards, Net Banking, Wallets" (true only if all are enabled in the Razorpay account).
- Footer "© 2026 Indian Mist" (fixed year).
- Blog category suggestions in the admin include "Sustainability".
- Order e-mails and OTP e-mails (out of scope: postponed).
