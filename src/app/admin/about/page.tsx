'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useAboutContent, useUpdateAbout } from '@/hooks/admin/useAboutPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, List, Link as LinkIcon, Loader2, X, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import { AboutContent } from '@/types/admin';
import AdminCard from '@/components/admin/ui/AdminCard';

export default function AdminAboutPage() {
  const { data, isLoading } = useAboutContent();
  const updateMutation = useUpdateAbout();

  const [content, setContent] = useState<AboutContent>({
    mission: { heading: '', body: '' },
    drivesUs: { heading: '', cards: [{ icon: 'Globe2', title: '', body: '' }] },
    cta: { heading: '', subtext: '', primaryButtonLabel: '', secondaryButtonLabel: '' }
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: content.mission.body,
    onUpdate: ({ editor }) => {
      setContent(prev => ({
        ...prev,
        mission: { ...prev.mission, body: editor.getHTML() }
      }));
    }
  });

  useEffect(() => {
    if (data) {
      setContent(data);
      if (editor && data.mission.body) {
        editor.commands.setContent(data.mission.body);
      }
    }
  }, [data, editor]);

  const handleSave = () => {
    updateMutation.mutate(content);
  };

  const addCard = () => {
    setContent(prev => ({
      ...prev,
      drivesUs: {
        ...prev.drivesUs,
        cards: [...prev.drivesUs.cards, { icon: 'Globe2', title: '', body: '' }]
      }
    }));
  };

  const removeCard = (idx: number) => {
    setContent(prev => ({
      ...prev,
      drivesUs: {
        ...prev.drivesUs,
        cards: prev.drivesUs.cards.filter((_, i) => i !== idx)
      }
    }));
  };

  const updateCard = (idx: number, field: string, val: string) => {
    setContent(prev => {
      const newCards = [...prev.drivesUs.cards];
      newCards[idx] = { ...newCards[idx], [field]: val };
      return { ...prev, drivesUs: { ...prev.drivesUs, cards: newCards } };
    });
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-olive size-8" /></div>;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">About Page Editor</h1>
      
      <Tabs defaultValue="mission" className="w-full max-w-4xl">
        <TabsList className="bg-warm border border-olive/15 mb-6">
          <TabsTrigger value="mission" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">Mission</TabsTrigger>
          <TabsTrigger value="drives" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">What Drives Us</TabsTrigger>
          <TabsTrigger value="cta" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">CTA Section</TabsTrigger>
          <TabsTrigger value="preview" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-olive data-[state=active]:text-cornsilk">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="mission">
          <AdminCard title="Mission Section">
            <div className="space-y-6">
              <AdminFormField label="Heading" required>
                <input 
                  value={content.mission.heading}
                  onChange={e => setContent(prev => ({ ...prev, mission: { ...prev.mission, heading: e.target.value } }))}
                  className={inputClass} 
                />
              </AdminFormField>

              <div>
                <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Body Content</label>
                <div className="bg-warm border border-olive/15 rounded-t-sm p-1 flex gap-1">
                  <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${editor?.isActive('bold') ? 'bg-card border border-olive/25' : 'hover:bg-card'}`}>
                    <Bold className="size-4 text-forest" />
                  </button>
                  <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${editor?.isActive('italic') ? 'bg-card border border-olive/25' : 'hover:bg-card'}`}>
                    <Italic className="size-4 text-forest" />
                  </button>
                  <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-card border border-olive/25' : 'hover:bg-card'}`}>
                    <Heading2 className="size-4 text-forest" />
                  </button>
                  <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${editor?.isActive('bulletList') ? 'bg-card border border-olive/25' : 'hover:bg-card'}`}>
                    <List className="size-4 text-forest" />
                  </button>
                </div>
                <EditorContent 
                  editor={editor} 
                  className="min-h-40 bg-cornsilk border border-olive/20 border-t-0 rounded-b-sm p-4 font-montserrat text-sm text-forest prose prose-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={updateMutation.isPending} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
                {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} Save Mission
              </button>
            </div>
          </AdminCard>
        </TabsContent>

        <TabsContent value="drives">
          <AdminCard title="What Drives Us Section">
            <div className="space-y-6">
              <AdminFormField label="Section Heading" required>
                <input 
                  value={content.drivesUs.heading}
                  onChange={e => setContent(prev => ({ ...prev, drivesUs: { ...prev.drivesUs, heading: e.target.value } }))}
                  className={inputClass} 
                />
              </AdminFormField>

              <div className="space-y-4">
                <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Value Cards</label>
                
                {content.drivesUs.cards.map((card, idx) => (
                  <div key={idx} className="bg-warm/50 border border-olive/15 rounded-md p-4 flex gap-4 items-start">
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <select 
                          value={card.icon} 
                          onChange={(e) => updateCard(idx, 'icon', e.target.value)}
                          className={`${inputClass} w-1/3`}
                        >
                          <option value="Globe2">Globe2</option>
                          <option value="RefreshCw">RefreshCw</option>
                          <option value="HeartHandshake">HeartHandshake</option>
                          <option value="Leaf">Leaf</option>
                          <option value="Trees">Trees</option>
                          <option value="Sparkles">Sparkles</option>
                        </select>
                        <input 
                          value={card.title} 
                          onChange={(e) => updateCard(idx, 'title', e.target.value)}
                          placeholder="Card Title" 
                          className={`${inputClass} w-2/3`} 
                        />
                      </div>
                      <textarea 
                        value={card.body}
                        onChange={(e) => updateCard(idx, 'body', e.target.value)}
                        placeholder="Card body text..." 
                        className={`${inputClass} h-20 resize-none`}
                      />
                    </div>
                    {content.drivesUs.cards.length > 1 && (
                      <button onClick={() => removeCard(idx)} className="p-2 text-copper hover:bg-copper/10 rounded-sm">
                        <X className="size-5" />
                      </button>
                    )}
                  </div>
                ))}

                <button onClick={addCard} className="flex items-center gap-2 font-montserrat text-xs text-olive hover:underline mt-2">
                  <Plus className="size-3" /> Add Card
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={updateMutation.isPending} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
                {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} Save What Drives Us
              </button>
            </div>
          </AdminCard>
        </TabsContent>

        <TabsContent value="cta">
          <AdminCard title="Call To Action Section">
            <div className="space-y-4">
              <AdminFormField label="Heading" required>
                <input 
                  value={content.cta.heading}
                  onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, heading: e.target.value } }))}
                  className={inputClass} 
                />
              </AdminFormField>
              <AdminFormField label="Subtext">
                <textarea 
                  value={content.cta.subtext}
                  onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, subtext: e.target.value } }))}
                  className={`${inputClass} h-20 resize-none`} 
                />
              </AdminFormField>
              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Primary Button Label">
                  <input 
                    value={content.cta.primaryButtonLabel}
                    onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, primaryButtonLabel: e.target.value } }))}
                    className={inputClass} 
                  />
                </AdminFormField>
                <AdminFormField label="Secondary Button Label">
                  <input 
                    value={content.cta.secondaryButtonLabel}
                    onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, secondaryButtonLabel: e.target.value } }))}
                    className={inputClass} 
                  />
                </AdminFormField>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={updateMutation.isPending} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
                {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} Save CTA
              </button>
            </div>
          </AdminCard>
        </TabsContent>

        <TabsContent value="preview">
          <div className="bg-clay/20 border-l-4 border-clay text-forest font-montserrat text-sm p-4 mb-6">
            <strong>This is a preview</strong> &mdash; save in other tabs to publish changes. Note that real rendering might differ slightly based on global layout.
          </div>
          
          <div className="border border-olive/20 rounded-md bg-background overflow-hidden p-8">
            <section className="mb-16">
              <h2 className="font-merriweather text-3xl md:text-4xl text-forest mb-6 text-center">{content.mission.heading}</h2>
              <div className="font-montserrat text-forest/90 leading-relaxed max-w-3xl mx-auto prose prose-olive" dangerouslySetInnerHTML={{ __html: content.mission.body }} />
            </section>

            <section className="mb-16 bg-warm p-8 rounded-md">
              <h2 className="font-merriweather text-2xl md:text-3xl text-forest mb-8 text-center">{content.drivesUs.heading}</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {content.drivesUs.cards.map((card, i) => (
                  <div key={i} className="bg-card p-6 rounded-md text-center">
                    <div className="w-12 h-12 bg-olive/10 text-olive flex items-center justify-center rounded-full mx-auto mb-4">
                      {/* Icon preview proxy */}
                      <span className="font-montserrat text-xs">{card.icon}</span>
                    </div>
                    <h3 className="font-merriweather text-lg text-forest mb-2">{card.title}</h3>
                    <p className="font-montserrat text-sm text-forest/80">{card.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="text-center">
              <h2 className="font-merriweather text-2xl text-forest mb-3">{content.cta.heading}</h2>
              <p className="font-montserrat text-forest/80 mb-6">{content.cta.subtext}</p>
              <div className="flex gap-4 justify-center">
                {content.cta.primaryButtonLabel && (
                  <button className="bg-forest text-cornsilk px-6 py-3 rounded-md font-montserrat text-sm uppercase tracking-wider">{content.cta.primaryButtonLabel}</button>
                )}
                {content.cta.secondaryButtonLabel && (
                  <button className="bg-transparent border border-forest text-forest px-6 py-3 rounded-md font-montserrat text-sm uppercase tracking-wider">{content.cta.secondaryButtonLabel}</button>
                )}
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </AdminProtectedRoute>
  );
}
