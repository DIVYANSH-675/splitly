import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportBytes } from './api';
export async function shareReport(tripId: string, format: 'pdf' | 'xlsx', analytics = false) {
  const bytes = await exportBytes(tripId, format, analytics);
  const name = `splitbill-report-${Date.now()}.${format}`;
  const mimeType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (Platform.OS === 'web') {
    const blob = new Blob([new Uint8Array(bytes).buffer], { type: mimeType });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error('File sharing is unavailable on this device.');
    const file = new File(Paths.cache, name);
    await file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: `Export ${format.toUpperCase()} report`,
      UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}
