import React, { useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from './Typography';
import { Btn, C, ErrorBox, Sheet, s } from './ui';
export function GroupScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, request] = useCameraPermissions();
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);
  return (
    <Sheet title="Scan to join" visible onClose={onClose}>
      <Text style={s.muted}>Point your camera at a group’s SplitBill QR code.</Text>
      {!permission?.granted ? (
        <Btn
          title="Allow camera for scanning"
          onPress={() => request().catch((e) => setError(e.message))}
        />
      ) : (
        <View
          style={{ height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: C.dark }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={
              scanned
                ? undefined
                : ({ data }) => {
                    const match = /^(?:splitbill:|splitly:\/\/join\?code=)?([A-Fa-f0-9]{12})$/.exec(
                      data.trim(),
                    );
                    if (!match) {
                      setError('This isn’t a SplitBill group code.');
                      return;
                    }
                    setScanned(true);
                    onCode(match[1].toUpperCase());
                  }
            }
          />
        </View>
      )}
      <ErrorBox text={error} />
      <Btn title="Enter code instead" secondary onPress={onClose} />
    </Sheet>
  );
}
