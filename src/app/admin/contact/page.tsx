"use client";

import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import {
  useSiteSettings,
  useUpdateSettings,
} from "@/hooks/admin/useSiteSettings";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminFormField, {
  inputClass,
} from "@/components/admin/ui/AdminFormField";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteSettings, ContactPageSettings } from "@/types/admin";

const defaultContactSettings: ContactPageSettings = {
  title: "Contact Us",
  subtitle: "We would love to hear from you. Get in touch with us for any queries.",
  address: "123 Forest Lane, Nature Valley, Earth 456789",
  phone: "+91 98765 43210",
  whatsapp: "+91 98765 43210",
  email: "hello@indianmist.com",
  businessHours: "Mon-Fri, 9:00 AM - 6:00 PM",
  faqs: [],
};

export default function AdminContactPage() {
  const { data, isLoading } = useSiteSettings();
  const updateMutation = useUpdateSettings();

  const [settings, setSettings] = useState<SiteSettings>({
    contactPageSettings: defaultContactSettings,
  });

  useEffect(() => {
    if (data) {
      setSettings((prev) => ({
        ...prev,
        ...data,
        contactPageSettings: {
          title: data.contactPageSettings?.title ?? defaultContactSettings.title,
          subtitle: data.contactPageSettings?.subtitle ?? defaultContactSettings.subtitle,
          address: data.contactPageSettings?.address ?? defaultContactSettings.address,
          phone: data.contactPageSettings?.phone ?? defaultContactSettings.phone,
          whatsapp: data.contactPageSettings?.whatsapp ?? defaultContactSettings.whatsapp,
          email: data.contactPageSettings?.email ?? defaultContactSettings.email,
          businessHours: data.contactPageSettings?.businessHours ?? defaultContactSettings.businessHours,
          faqs: (data.contactPageSettings?.faqs ?? []).map((f) => ({
            question: f.question,
            answer: f.answer,
          })),
        },
      }));
    }
  }, [data]);

  const contact = settings.contactPageSettings || defaultContactSettings;

  const handleChange = (field: keyof ContactPageSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      contactPageSettings: {
        ...(prev.contactPageSettings || defaultContactSettings),
        [field]: value,
      },
    }));
  };

  const faqs = contact.faqs ?? [];

  const setFaqs = (next: { question: string; answer: string }[]) => {
    setSettings((prev) => ({
      ...prev,
      contactPageSettings: {
        ...(prev.contactPageSettings || defaultContactSettings),
        faqs: next,
      },
    }));
  };

  const updateFaq = (index: number, field: "question" | "answer", value: string) =>
    setFaqs(faqs.map((f, i) => (i === index ? { ...f, [field]: value } : f)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
    updateMutation.mutate({
      ...settings,
      contactPageSettings: { ...contact, faqs: cleanedFaqs },
    });
    setFaqs(cleanedFaqs);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-olive size-8" />
      </div>
    );
  }

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">
        Contact Page Settings
      </h1>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <AdminCard title="Contact Info">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Page Title">
                <input
                  value={contact.title ?? ""}
                  onChange={(e) => handleChange("title", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Contact Us"
                />
              </AdminFormField>
              <AdminFormField label="Page Subtitle">
                <input
                  value={contact.subtitle ?? ""}
                  onChange={(e) => handleChange("subtitle", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Get in touch with us..."
                />
              </AdminFormField>
            </div>

            <AdminFormField label="Address">
              <textarea
                value={contact.address ?? ""}
                onChange={(e) => handleChange("address", e.target.value)}
                className={`${inputClass} resize-none h-24`}
                placeholder="Full address of your store/office"
              />
            </AdminFormField>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AdminFormField label="Phone Number">
                <input
                  value={contact.phone ?? ""}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. +91 98765 43210"
                />
              </AdminFormField>
              <AdminFormField label="WhatsApp Number">
                <input
                  value={contact.whatsapp ?? ""}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. +91 98765 43210"
                />
              </AdminFormField>
              <AdminFormField label="Email Address">
                <input
                  type="email"
                  value={contact.email ?? ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. hello@indianmist.com"
                />
              </AdminFormField>
            </div>

            <AdminFormField label="Business Hours">
              <input
                value={contact.businessHours ?? ""}
                onChange={(e) => handleChange("businessHours", e.target.value)}
                className={inputClass}
                placeholder="e.g. Mon-Fri, 9:00 AM - 6:00 PM"
              />
            </AdminFormField>
          </div>
        </AdminCard>

        <AdminCard
          title="Frequently Asked Questions"
          description="Shown at the bottom of the contact page. The section is hidden when there are no questions."
          action={
            <button
              type="button"
              onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-olive hover:text-forest transition-colors"
            >
              <Plus className="size-4" /> Add Question
            </button>
          }
        >
          {faqs.length === 0 ? (
            <p className="font-sans text-sm text-forest/60">
              No questions yet. Click &ldquo;Add Question&rdquo; to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="rounded-md border border-olive/15 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-xs font-semibold uppercase tracking-wider text-forest/60">
                      Question {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                      className="text-red-600 hover:text-red-700 transition-colors"
                      aria-label={`Delete question ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <AdminFormField label="Question">
                    <input
                      value={faq.question}
                      onChange={(e) => updateFaq(index, "question", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. How can I track my order?"
                    />
                  </AdminFormField>
                  <AdminFormField label="Answer">
                    <textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(index, "answer", e.target.value)}
                      className={`${inputClass} resize-y h-24`}
                      placeholder="Write the answer here"
                    />
                  </AdminFormField>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-[150px]"
          >
            {updateMutation.isPending ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
