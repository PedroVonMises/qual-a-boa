import { Platform, Share } from 'react-native';

/**
 * Hands a text file to the user: a download on web, the system share sheet on native.
 * True when it was delivered (web) or not dismissed (native). Never throws.
 */
export async function shareTextFile(filename: string, text: string, mime = 'application/json'): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    }
    const res = await Share.share({ message: text, title: filename });
    return res.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
