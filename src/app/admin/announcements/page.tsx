'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import { useAnnouncements, useToggleAnnouncement, useReorderAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from '@/hooks/admin/useAdminAnnouncements';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Pencil, Trash2, Megaphone, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Announcement } from '@/types/admin';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';

export default function AdminAnnouncementsPage() {
  const { data: announcements, isLoading } = useAnnouncements();
  const toggleMutation = useToggleAnnouncement();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  
  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Simplified drag and drop state (just for UX visual, real implementation needs fuller DND library or more logic)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleEdit = (item: Announcement) => {
    setEditingItem(item);
    setText(item.text);
    setLinkUrl(item.linkUrl || '');
    setLinkText(item.linkText || '');
    setIsActive(item.isActive);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setText('');
    setLinkUrl('');
    setLinkText('');
    setIsActive(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;

    if (editingItem) {
      updateMutation.mutate({ id: editingItem._id, text, linkUrl, linkText, isActive }, {
        onSuccess: handleCancelEdit
      });
    } else {
      createMutation.mutate({ text, linkUrl, linkText, isActive, order: announcements ? announcements.length : 0 }, {
        onSuccess: handleCancelEdit
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Announcements</h1>

      {/* Live Preview */}
      <div className="mb-8">
        <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest/60 mb-2">Live Preview</h3>
        <div className="bg-forest text-cornsilk/80 text-center text-xs py-2 font-montserrat uppercase tracking-wide">
          {text || 'Your announcement will appear here'}
          {linkUrl && linkText && (
            <a href="#" className="ml-2 text-cornsilk hover:underline">{linkText}</a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-olive size-8" /></div>
          ) : announcements?.length === 0 ? (
            <AdminCard className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="size-12 text-olive/30 mb-3" />
              <p className="font-montserrat text-sm text-forest/60">No announcements yet</p>
            </AdminCard>
          ) : (
            announcements?.map((item, idx) => (
              <AdminCard key={item._id} className="flex items-center justify-between !p-4 group">
                <div className="flex items-center gap-4">
                  <div className="cursor-grab text-forest/60/50 hover:text-forest/60 active:cursor-grabbing">
                    <GripVertical className="size-5" />
                  </div>
                  <Switch 
                    checked={item.isActive} 
                    onCheckedChange={(val) => toggleMutation.mutate({ id: item._id, isActive: val })}
                  />
                  <div>
                    <p className="font-montserrat text-sm text-forest font-medium">{item.text}</p>
                    {item.linkUrl && <p className="font-montserrat text-xs text-olive mt-0.5">{item.linkText} → {item.linkUrl}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(item)} className="p-2 text-olive hover:bg-olive/10 rounded-sm">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(item._id)} className="p-2 text-copper hover:bg-copper/10 rounded-sm">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </AdminCard>
            ))
          )}
        </div>

        {/* Right: Form */}
        <div>
          <AdminCard title={editingItem ? 'Edit Announcement' : 'Add New Announcement'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <AdminFormField label="Announcement Text" required>
                <div className="relative">
                  <input 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    maxLength={200}
                    className={inputClass} 
                    placeholder="Free shipping on all orders over $50" 
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-montserrat text-forest/60">
                    {text.length}/200
                  </span>
                </div>
              </AdminFormField>

              <div className="grid grid-cols-2 gap-4">
                <AdminFormField label="Link Text (Optional)">
                  <input value={linkText} onChange={e => setLinkText(e.target.value)} className={inputClass} placeholder="Shop Now" />
                </AdminFormField>
                <AdminFormField label="Link URL (Optional)">
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className={inputClass} placeholder="/products" />
                </AdminFormField>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} id="active-toggle" />
                  <label htmlFor="active-toggle" className="font-montserrat text-xs text-forest">Set Active immediately</label>
                </div>
                <div className="flex gap-2">
                  {editingItem && (
                    <button type="button" onClick={handleCancelEdit} className="px-4 py-2 text-xs font-montserrat uppercase tracking-wider text-forest/60 hover:bg-black/5 rounded-sm">
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={isPending || !text}
                    className="bg-forest text-cornsilk px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-[100px]"
                  >
                    {isPending ? <Loader2 className="animate-spin size-4" /> : (editingItem ? 'Save' : 'Add')}
                  </button>
                </div>
              </div>
            </form>
          </AdminCard>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
