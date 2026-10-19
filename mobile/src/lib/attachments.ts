import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, attachmentBytes } from './api';
import type { Attachment } from './types';
const types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export async function pickAttachment(): Promise<Attachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.size || asset.size > 2_000_000) throw new Error('Choose a file under 2 MB.');
  const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
  const dir = new Directory(Paths.document, 'bill-attachments');
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, id);
  new File(asset.uri).copy(file);
  return { id, name: asset.name, mime: asset.mimeType || '', size: asset.size, localUri: file.uri };
}
export async function uploadAttachments(tripId: string, files: Attachment[] = []) {
  const saved: Attachment[] = [];
  for (const file of files) {
    if (!file.localUri) {
      saved.push(file);
      continue;
    }
    saved.push(
      await api<Attachment>(`/trips/${tripId}/attachments`, 'POST', {
        id: file.id,
        name: file.name,
        mime: file.mime,
        data: await new File(file.localUri).base64(),
      }),
    );
  }
  return saved;
}
export async function openAttachment(tripId: string, attachment: Attachment) {
  const bytes = await attachmentBytes(tripId, attachment.id);
  const file = new File(Paths.cache, attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
  await file.write(bytes);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: attachment.mime, dialogTitle: attachment.name });
}
