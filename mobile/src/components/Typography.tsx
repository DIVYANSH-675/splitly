import React from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';
export function Text({ style, ...props }: TextProps) {
  const weight = Number(StyleSheet.flatten(style)?.fontWeight || 400);
  const fontFamily =
    weight >= 700
      ? 'ManropeBold'
      : weight >= 600
        ? 'ManropeSemiBold'
        : weight >= 500
          ? 'ManropeMedium'
          : 'ManropeRegular';
  return <NativeText {...props} style={[{ fontFamily }, style, { fontWeight: 'normal' }]} />;
}
