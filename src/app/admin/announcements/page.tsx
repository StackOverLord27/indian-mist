'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import { useAnnouncements, useToggleAnnouncement, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement } from '@/hooks/admin/useAdminAnnouncements';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Megaphone, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Announcement } from '@/types/admin';
import { getApiErrorMessage } from '@/lib/admin-error';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';

export default function AdminAnnouncementsPage() {
  const { data: announcements, isLoading, isError, error, refetch } = useAnnouncements();
  const toggleMutation = useToggleAnnouncement();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  
  const [text, setText] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleEdit = (item: Announcement) => {
    setEditingItem(item);
    setText(item.text);
    setIsActive(item.isActive);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setText('');
    setIsActive(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (editingItem) {
      updateMutation.mutate({ id: editingItem._id, text: text.trim(), isActive }, {
        onSuccess: handleCancelEdit
      });
    } else {
      createMutation.mutate({ text: text.trim(), isActive }, {
        onSuccess: handleCancelEdit
      });
    }
  };

  const handleDelete = (item: Announcement) => {
    if (!confirm(`Delete "${item.text}"? This cannot be undone.`)) return;
    deleteMutation.mutate(item._id, {
      // Deleting the item being edited would leave the form pointing at nothing
      onSuccess: () => { if (editingItem?._id === item._id) handleCancelEdit(); },
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Announcements</h1>

      {/* Live Preview: same classes as the storefront bar (AnnouncementBarClient) */}
      <div className="mb-8">
        <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest/60 mb-2">Live Preview</h3>
        <div className="flex h-8 w-full items-center justify-center overflow-hidden bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk sm:h-7">
          <span className="block truncate">{text.trim() || 'Your announcement will appear here'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-olive size-8" /></div>
          ) : isError ? (
            <AdminCard className="py-8 text-center">
              <p className="font-montserrat text-sm text-copper mb-3">{getApiErrorMessage(error, 'Could not load announcements')}</p>
              <button onClick={() => refetch()} className="text-xs font-montserrat uppercase tracking-wider text-olive hover:underline">Try again</button>
            </AdminCard>
          ) : announcements?.length === 0 ? (
            <AdminCard className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="size-12 text-olive/30 mb-3" />
              <p className="font-montserrat text-sm text-forest/60">No announcements yet</p>
            </AdminCard>
          ) : (
            announcements?.map((item) => (
              <AdminCard key={item._id} className="flex items-center justify-between !p-4 group">
                <div className="flex items-center gap-4">
                  <Switch 
                    checked={item.isActive} 
                    disabled={toggleMutation.isPending && toggleMutation.variables?.id === item._id}
                    onCheckedChange={(val) => toggleMutation.mutate({ id: item._id, isActive: val })}
                    aria-label={item.isActive ? 'Deactivate announcement' : 'Activate announcement'}
                  />
                  <div>
                    <p className="font-montserrat text-sm text-forest font-medium">{item.text}</p>
                    {!item.isActive && <p className="font-montserrat text-xs text-forest/50 mt-0.5">Hidden from the storefront</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(item)} aria-label="Edit announcement" className="p-2 text-olive hover:bg-olive/10 rounded-sm">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deleteMutation.isPending && deleteMutation.variables === item._id}
                    aria-label="Delete announcement"
                    className="p-2 text-copper hover:bg-copper/10 rounded-sm disabled:opacity-50"
                  >
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
                    placeholder="Free shipping on all orders over ₹999" 
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-montserrat text-forest/60">
                    {text.length}/200
                  </span>
                </div>
              </AdminFormField>

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
                    disabled={isPending || !text.trim()}
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
