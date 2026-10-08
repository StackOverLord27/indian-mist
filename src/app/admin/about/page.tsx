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
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { adminAxios } from '@/lib/admin-axios';
import toast from 'react-hot-toast';
import { AVAILABLE_ICONS } from '@/lib/icon-map';

export default function AdminAboutPage() {
  const { data, isLoading } = useAboutContent();
  const updateMutation = useUpdateAbout();
  const [isUploading, setIsUploading] = useState(false);

  const [content, setContent] = useState<AboutContent>({
    mission: { heading: '', body: '' },
    drivesUs: { heading: '', cards: [{ icon: 'Globe2', title: '', body: '' }] },
    cta: { heading: '', subtext: '', primaryButtonLabel: '', secondaryButtonLabel: '', primaryButtonLink: '', secondaryButtonLink: '' },
    customSections: []
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
      setContent(prev => ({
        ...prev,
        ...data,
        mission: {
          heading: data.mission?.heading ?? prev.mission.heading,
          body: data.mission?.body ?? prev.mission.body,
        },
        drivesUs: {
          heading: data.drivesUs?.heading ?? prev.drivesUs.heading,
          cards: data.drivesUs?.cards && data.drivesUs.cards.length > 0
            ? data.drivesUs.cards
            : prev.drivesUs.cards,
        },
        cta: {
          heading: data.cta?.heading ?? prev.cta.heading,
          subtext: data.cta?.subtext ?? prev.cta.subtext,
          primaryButtonLabel: data.cta?.primaryButtonLabel ?? prev.cta.primaryButtonLabel,
          primaryButtonLink: data.cta?.primaryButtonLink ?? prev.cta.primaryButtonLink,
          secondaryButtonLabel: data.cta?.secondaryButtonLabel ?? prev.cta.secondaryButtonLabel,
          secondaryButtonLink: data.cta?.secondaryButtonLink ?? prev.cta.secondaryButtonLink,
        },
        customSections: data.customSections ?? prev.customSections,
      }));
      if (editor && data.mission?.body) {
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

  const addCustomSection = () => {
    setContent(prev => ({
      ...prev,
      customSections: [
        ...(prev.customSections || []),
        {
          type: 'image-text-split',
          heading: '',
          body: '',
          imageUrl: '',
          imagePublicId: '',
          imageAlt: '',
          imageAlignment: 'left',
          order: (prev.customSections?.length || 0)
        }
      ]
    }));
  };

  const updateCustomSection = (idx: number, field: string, val: any) => {
    setContent(prev => {
      const newSections = [...(prev.customSections || [])];
      newSections[idx] = { ...newSections[idx], [field]: val };
      return { ...prev, customSections: newSections };
    });
  };

  const removeCustomSection = (idx: number) => {
    setContent(prev => ({
      ...prev,
      customSections: (prev.customSections || []).filter((_, i) => i !== idx)
    }));
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-olive size-8" /></div>;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">About Page Editor</h1>
      
      <Tabs defaultValue="mission" className="w-full max-w-4xl">
        <TabsList className="bg-warm border border-olive/15 mb-6">
          <TabsTrigger value="mission" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">Mission</TabsTrigger>
          <TabsTrigger value="drives" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">What Drives Us</TabsTrigger>
          <TabsTrigger value="custom" className="font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk">Custom Sections</TabsTrigger>
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
              <button onClick={handleSave} disabled={updateMutation.isPending || isUploading} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
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
                          className={inputClass}
                        >
                          {AVAILABLE_ICONS.map(icon => (
                            <option key={icon} value={icon}>{icon}</option>
                          ))}
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
              <button onClick={handleSave} disabled={updateMutation.isPending || isUploading} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
                {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} Save What Drives Us
              </button>
            </div>
          </AdminCard>
        </TabsContent>

        <TabsContent value="custom">
          <AdminCard title="Custom Sections">
            <div className="space-y-6">
              {(content.customSections || []).map((section, idx) => (
                <div key={idx} className="bg-warm/50 border border-olive/15 rounded-md p-6 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-merriweather text-lg text-forest">Section {idx + 1}</h3>
                    <button onClick={() => removeCustomSection(idx)} className="text-copper hover:text-red-700 text-sm font-semibold">Remove</button>
                  </div>
                  
                  <AdminFormField label="Heading">
                    <input 
                      value={section.heading}
                      onChange={(e) => updateCustomSection(idx, 'heading', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Crafted in the Wild"
                    />
                  </AdminFormField>

                  <AdminFormField label="Body Text">
                    <textarea 
                      value={section.body}
                      onChange={(e) => updateCustomSection(idx, 'body', e.target.value)}
                      className={`${inputClass} h-24 resize-none`}
                      placeholder="Write your story here..."
                    />
                  </AdminFormField>

                  <div className="grid grid-cols-2 gap-4">
                    <AdminFormField label="Image Alignment">
                      <select 
                        value={section.imageAlignment}
                        onChange={(e) => updateCustomSection(idx, 'imageAlignment', e.target.value)}
                        className={inputClass}
                      >
                        <option value="left">Image on Left</option>
                        <option value="right">Image on Right</option>
                      </select>
                    </AdminFormField>
                  </div>

                  <AdminFormField label="Section Image">
                    <ImageUploadZone 
                      hint="Recommended: 1600 × 1200 px (4:3). Keep the subject in the centre."
                      multiple={false}
                      maxFiles={1}
                      currentImages={section.imageUrl ? [{ url: section.imageUrl, publicId: section.imagePublicId || section.imageUrl, isPrimary: true }] : []}
                      onRemoveExisting={() => {
                        updateCustomSection(idx, 'imageUrl', '');
                        updateCustomSection(idx, 'imagePublicId', '');
                      }}
                      onFilesSelected={async (files) => {
                        if (files.length === 0) return;
                        setIsUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', files[0]);
                          formData.append('context', 'about-custom');
                          const { data } = await adminAxios.post('/api/admin/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          updateCustomSection(idx, 'imageUrl', data.url);
                          updateCustomSection(idx, 'imagePublicId', data.publicId);
                          toast.success('Image uploaded successfully');
                        } catch (error) {
                          toast.error('Failed to upload image');
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                  </AdminFormField>
                </div>
              ))}

              <button onClick={addCustomSection} className="w-full bg-olive/10 text-forest hover:bg-olive/20 px-4 py-4 rounded-md border border-olive/20 border-dashed font-montserrat text-sm font-semibold flex items-center justify-center gap-2">
                <Plus className="size-4" /> Add Image + Text Block
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={updateMutation.isPending || isUploading} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
                {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} Save Sections
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
                <AdminFormField label="Primary Button Link">
                  <input 
                    value={content.cta.primaryButtonLink || ''}
                    onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, primaryButtonLink: e.target.value } }))}
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
                <AdminFormField label="Secondary Button Link">
                  <input 
                    value={content.cta.secondaryButtonLink || ''}
                    onChange={e => setContent(prev => ({ ...prev, cta: { ...prev.cta, secondaryButtonLink: e.target.value } }))}
                    className={inputClass} 
                  />
                </AdminFormField>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={handleSave} disabled={updateMutation.isPending || isUploading} className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2">
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

            {content.customSections && content.customSections.length > 0 && (
              <section className="mb-16">
                <div className="text-center font-montserrat text-xs text-forest/50 uppercase tracking-widest mb-4">--- Custom Sections Preview ---</div>
                {content.customSections.map((sec, idx) => (
                  <div key={idx} className={`flex flex-col ${sec.imageAlignment === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 mb-8 border border-olive/10 p-4 rounded-md`}>
                    <div className="w-full md:w-1/2 bg-warm min-h-40 flex items-center justify-center text-forest/40 text-sm italic">
                      {sec.imageUrl ? "Image: " + sec.imageUrl.split('/').pop() : "No image uploaded"}
                    </div>
                    <div className="w-full md:w-1/2">
                      <h3 className="font-merriweather text-xl text-forest mb-3">{sec.heading}</h3>
                      <p className="font-montserrat text-sm text-forest/80 whitespace-pre-line">{sec.body}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}

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
