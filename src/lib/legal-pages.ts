export const LEGAL_SLUGS = ["privacy-policy", "terms-and-conditions"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

// Shown until an admin saves their own text
export const LEGAL_DEFAULTS: Record<LegalSlug, { title: string; content: string }> = {
  "privacy-policy": {
    title: "Privacy Policy",
    content: `<h2>Information we collect</h2><p>We collect the details you give us when you create an account, place an order, subscribe to our newsletter or contact us, such as your name, email address, phone number and delivery address.</p><h2>How we use it</h2><p>We use your information to process orders, deliver products, respond to your queries and, if you opt in, send you updates. We do not sell your personal information.</p><h2>Payments</h2><p>Payments are handled by our payment partner. We do not store your card details.</p><h2>Contact us</h2><p>For any questions about this policy, please reach out through our Contact page.</p>`,
  },
  "terms-and-conditions": {
    title: "Terms & Conditions",
    content: `<h2>Using our website</h2><p>By using this website and placing an order, you agree to these terms. Please read them carefully.</p><h2>Orders and pricing</h2><p>All prices are in Indian Rupees. We reserve the right to cancel or refuse an order in case of stock or pricing errors, in which case you will be refunded in full.</p><h2>Shipping and returns</h2><p>Delivery times are estimates. Please contact us if there is a problem with your order.</p><h2>Changes</h2><p>We may update these terms from time to time. The latest version will always be available on this page.</p>`,
  },
};
