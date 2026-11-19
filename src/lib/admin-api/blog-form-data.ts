/**
 * The multipart request the blog forms (new and edit) send. Shared by both pages and the tests.
 *   file             the new cover image
 *   coverImageAlt    its description
 *   removeCoverImage "true" to delete the current cover (edit only, ignored when `file` is sent)
 */
export type BlogFormValues = {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  isPublished: boolean;
  tagsInput: string;
  coverFile: File | null;
  coverAlt: string;
  removeCover?: boolean;
};

export function buildBlogFormData(v: BlogFormValues): FormData {
  const formData = new FormData();
  formData.append('title', v.title);
  formData.append('excerpt', v.excerpt);
  formData.append('content', v.content);
  formData.append('category', v.category);
  formData.append('author', v.author);
  formData.append('isPublished', String(v.isPublished));
  formData.append('tags', JSON.stringify(v.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)));
  if (v.coverFile) {
    formData.append('file', v.coverFile);
    formData.append('coverImageAlt', v.coverAlt || v.title);
  } else {
    if (v.coverAlt) formData.append('coverImageAlt', v.coverAlt);
    if (v.removeCover) formData.append('removeCoverImage', 'true');
  }
  return formData;
}
