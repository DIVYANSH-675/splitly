import * as DocumentPicker from 'expo-document-picker';
import { api, attachmentBytes } from './api';
import type { Attachment } from './types';
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('splitbill-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Cannot save this file on your device.'));
  });
}
async function stored(id: string, value?: Blob): Promise<Blob> {
  const db = await database();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const tx = db.transaction('files', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('files');
      const request = value ? store.put(value, id) : store.get(id);
      let result: Blob;
      request.onsuccess = () => {
        result = value || request.result;
      };
      tx.oncomplete = () =>
        result
          ? resolve(result)
          : reject(new Error('Saved attachment is missing. Please attach it again.'));
      tx.onerror = () => reject(new Error('Could not save the attachment. Check free storage.'));
      tx.onabort = tx.onerror;
    });
  } finally {
    db.close();
  }
}
export async function pickAttachment(): Promise<Attachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const blob = asset.file || (await (await fetch(asset.uri)).blob());
  if (!blob.size || blob.size > 2_000_000) throw new Error('Choose a file under 2 MB.');
  const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  await stored(id, blob);
  return { id, name: asset.name, mime: blob.type, size: blob.size, localUri: `local:${id}` };
}
export async function uploadAttachments(tripId: string, files: Attachment[] = []) {
  const saved: Attachment[] = [];
  for (const file of files) {
    if (!file.localUri) {
      saved.push(file);
      continue;
    }
    const blob = await stored(file.id);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read the saved file.'));
      reader.readAsDataURL(blob);
    });
    saved.push(
      await api<Attachment>(`/trips/${tripId}/attachments`, 'POST', {
        id: file.id,
        name: file.name,
        mime: file.mime,
        data,
      }),
    );
  }
  return saved;
}
export async function openAttachment(tripId: string, file: Attachment) {
  const bytes = await attachmentBytes(tripId, file.id);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
