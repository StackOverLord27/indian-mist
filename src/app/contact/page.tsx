import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { ContactForm } from "@/components/contact/ContactForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Mail, MapPin, Phone, Clock, Plus, ChevronRight } from "lucide-react";
import { FaInstagram, FaFacebook, FaXTwitter, FaYoutube, FaWhatsapp } from "react-icons/fa6";

export const revalidate = 60;

export default async function ContactPage() {
  await dbConnect();
  const settings = (await SiteSettingsModel.findOne().lean()) as any;

  const c = settings?.contactPageSettings || {
    title: "Contact Us",
    subtitle:
      "Questions about an order, a product, or just want to say hello? Send us a message and a real person will get back to you.",
    address: "123 Forest Lane, Nature Valley, Earth 456789",
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "hello@indianmist.com",
    businessHours: "Mon–Fri, 9:00 AM – 6:00 PM",
  };

  const faqs: { question: string; answer: string }[] = (c.faqs ?? []).filter(
    (f: { question?: string; answer?: string }) => f.question?.trim() && f.answer?.trim()
  );

  const socialLinks = settings?.socialLinks || {};
  const socials = [
    { key: "instagram", url: socialLinks.instagram, icon: FaInstagram, label: "Instagram" },
    { key: "facebook", url: socialLinks.facebook, icon: FaFacebook, label: "Facebook" },
    { key: "twitter", url: socialLinks.twitter, icon: FaXTwitter, label: "X" },
    { key: "youtube", url: socialLinks.youtube, icon: FaYoutube, label: "YouTube" },
  ].filter((s) => s.url);

  const whatsappUrl = `https://wa.me/${(c.whatsapp || c.phone).replace(/[^0-9]/g, "")}?text=Hi%20Indian%20Mist!`;

  const details = [
    { icon: MapPin, label: "Visit us", value: c.address, href: undefined as string | undefined },
    { icon: Phone, label: "Call us", value: c.phone, href: `tel:${c.phone}` },
    { icon: Mail, label: "Email us", value: c.email, href: `mailto:${c.email}` },
    { icon: Clock, label: "Business hours", value: c.businessHours, href: undefined as string | undefined },
  ];

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        <Breadcrumb
          className="pb-2"
          items={[
            { label: "Home", href: "/" },
            { label: "Contact" },
          ]}
        />

        <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest mt-2 mb-2">
          {c.title}
        </h1>
        <p className="font-montserrat text-sm font-light text-muted-text max-w-xl">
          {c.subtitle}
        </p>

        {/* Details come first on mobile, form first on desktop */}
        <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:gap-12">
          <aside className="order-1 space-y-5 lg:order-2 lg:col-span-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-md bg-[#25D366] p-5 text-black-forest shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black-forest text-[#25D366]">
                <FaWhatsapp className="size-5" aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block font-merriweather text-base font-normal leading-tight">
                  Chat on WhatsApp
                </span>
                <span className="mt-1 block font-montserrat text-xs font-medium text-black-forest/85">
                  Fastest way to reach us
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>

            <div className="divide-y divide-olive/10 rounded-md border border-olive/15 bg-card-bg">
              {details.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-4 p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-olive/25 bg-warm text-olive">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-montserrat text-xs font-medium uppercase tracking-wider text-forest/75">
                      {label}
                    </p>
                    {href ? (
                      <a href={href} className="mt-1 block wrap-break-word font-montserrat text-sm text-forest transition-colors hover:text-olive">
                        {value}
                      </a>
                    ) : (
                      <p className="mt-1 whitespace-pre-line font-montserrat text-sm leading-6 text-forest">{value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {socials.length > 0 && (
              <div className="rounded-md border border-olive/15 bg-warm p-5">
                <p className="font-montserrat text-xs font-medium uppercase tracking-wider text-forest/75">
                  Follow along
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {socials.map((s) => (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="flex size-11 items-center justify-center rounded-full border border-olive/30 text-olive transition-colors hover:border-olive hover:bg-olive hover:text-cornsilk"
                    >
                      <s.icon size={18} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="order-2 lg:order-1 lg:col-span-3">
            <div className="rounded-md border border-olive/15 bg-card-bg p-5 shadow-sm md:p-8">
              <h2 className="font-merriweather text-xl font-normal text-forest md:text-2xl">
                Send us a message
              </h2>
              <p className="mt-2 mb-7 font-montserrat text-sm font-light text-muted-text">
                Fill in the form and we&rsquo;ll reply by email.
              </p>
              <ContactForm />
            </div>
          </div>
        </div>

        {faqs.length > 0 && (
          <section className="mt-16 md:mt-20">
            <h2 className="font-merriweather text-2xl font-normal text-forest">
              Frequently Asked Questions
            </h2>
            <div className="w-12 h-px bg-forest mt-3 mb-8" />

            <div className="max-w-3xl">
              {faqs.map((item, i) => (
                <details key={i} className="group border-b border-olive/20 first:border-t">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-merriweather text-base font-normal text-forest marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <Plus className="size-5 shrink-0 text-olive transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 font-montserrat text-sm font-light leading-7 text-muted-text whitespace-pre-line">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
