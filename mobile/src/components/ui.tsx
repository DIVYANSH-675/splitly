import React, { useEffect, useState } from 'react';
import {
  Image,
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Text } from './Typography';
export const C = {
  accent: '#285443',
  lime: '#DDF49B',
  dark: '#233C30',
  muted: '#66725F',
  line: '#E4E8DE',
  bg: '#F6F6EF',
  pale: '#EBF0E2',
  green: '#3C7555',
  red: '#A45145',
  forest: '#193E30',
  white: '#FFFFFF',
};
export function Icon({
  name,
  photo,
  size = 22,
  color = C.dark,
}: {
  name: string;
  photo?: string;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name as React.ComponentProps<typeof Ionicons>['name']}
      size={size}
      color={color}
    />
  );
}
export function Logo({ small = false, light = false }: { small?: boolean; light?: boolean }) {
  return (
    <View style={[s.row, { gap: 10 }]}>
      <View
        style={{
          width: small ? 34 : 43,
          height: small ? 34 : 43,
          borderRadius: small ? 12 : 15,
          backgroundColor: light ? C.lime : C.forest,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-7deg' }],
        }}
      >
        <View style={{ flexDirection: 'row', gap: 3, transform: [{ rotate: '7deg' }] }}>
          <View
            style={{
              width: 8,
              height: 19,
              borderTopLeftRadius: 9,
              borderBottomLeftRadius: 9,
              backgroundColor: light ? C.forest : C.lime,
            }}
          />
          <View
            style={{
              width: 8,
              height: 19,
              borderTopRightRadius: 9,
              borderBottomRightRadius: 9,
              backgroundColor: light ? C.forest : C.lime,
              marginTop: -5,
            }}
          />
        </View>
      </View>
      <Text
        style={{
          fontSize: small ? 23 : 28,
          fontWeight: '800',
          letterSpacing: -1.2,
          color: light ? '#F4F8EB' : C.dark,
        }}
      >
        SplitBill<Text style={{ color: light ? C.lime : C.accent, fontWeight: '800' }}>.</Text>
      </Text>
    </View>
  );
}
export function Enter({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive) return;
        if (reduced) progress.setValue(1);
        else {
          animation = Animated.timing(progress, {
            toValue: 1,
            duration: 320,
            delay,
            useNativeDriver: Platform.OS !== 'web',
          });
          animation.start();
        }
      })
      .catch(() => progress.setValue(1));
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [progress, delay]);
  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
export function Btn({
  title,
  onPress,
  secondary,
  disabled,
  busy,
  icon,
  danger,
  small,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: string;
  danger?: boolean;
  small?: boolean;
}) {
  const color = danger ? C.red : C.dark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && s.secondary,
        small && { minHeight: 44, paddingHorizontal: 17, borderRadius: 15 },
        danger && { backgroundColor: '#F7E9E4', borderColor: '#F7E9E4' },
        (disabled || busy) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={C.accent} />
      ) : (
        <>
          {icon && <Icon name={icon} size={21} color={color} />}
          <Text style={[s.btnText, { color }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
export function Field({ label, onFocus, onBlur, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9BA397"
        selectionColor={C.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
        style={[
          s.input,
          focused && { borderColor: C.accent, backgroundColor: '#fff' },
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function ErrorBox({ text }: { text: string }) {
  return text ? (
    <View accessibilityRole="alert" style={s.error}>
      <Icon name="alert-circle-outline" size={19} color={C.red} />
      <Text style={{ color: C.red, flex: 1, lineHeight: 21, fontSize: 13 }}>{text}</Text>
    </View>
  ) : null;
}
export function Chip({
  title,
  active,
  onPress,
  icon,
}: {
  title: string;
  active?: boolean;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        active && { backgroundColor: C.forest, borderColor: C.forest },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={active ? C.lime : C.dark} />}
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? '700' : '500',
          color: active ? '#F4F7ED' : C.dark,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
const avatarColors = ['#E6EDD7', '#F2E5DA', '#E6E5F1', '#DDEBF0', '#F0E7C8'];
export function Avatar({
  name,
  photo,
  size = 40,
  index = 0,
}: {
  name: string;
  photo?: string;
  size?: number;
  index?: number;
}) {
  if (photo)
    return (
      <Image
        source={{ uri: photo }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: C.bg,
        }}
        accessibilityLabel={`${name} profile photo`}
      />
    );
  const initials = name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColors[index % avatarColors.length],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.bg,
      }}
    >
      <Text style={{ fontSize: size * 0.33, color: C.dark, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}
export function FacePile({ members }: { members: { id: string; name: string; photo?: string }[] }) {
  return (
    <View style={[s.row, { gap: 0 }]}>
      {members.slice(0, 4).map((m, i) => (
        <View key={m.id} style={{ marginLeft: i ? -9 : 0 }}>
          <Avatar photo={m.photo} name={m.name} size={31} index={i} />
        </View>
      ))}
      {members.length > 4 && (
        <Text style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>+{members.length - 4}</Text>
      )}
    </View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        pressed && { backgroundColor: C.pale, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Icon name={name} size={21} />
    </Pressable>
  );
}
export function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, gap: 13 }}>
      <View style={s.emptyIcon}>
        <View
          style={{
            position: 'absolute',
            width: 76,
            height: 76,
            backgroundColor: '#DEE8CB',
            borderRadius: 28,
            transform: [{ rotate: '-12deg' }],
          }}
        />
        <Icon name={icon} size={31} color={C.accent} />
      </View>
      <Text style={[s.h3, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 270 }]}>{text}</Text>
    </View>
  );
}
export function Sheet({
  visible,
  title,
  onClose,
  children,
  onBack,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onBack?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.scrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.sheet}
        >
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View
              style={{
                width: 35,
                height: 4,
                borderRadius: 3,
                backgroundColor: '#D2D8CA',
                alignSelf: 'center',
                marginTop: 12,
              }}
            />
            <View style={s.sheetHeader}>
              {onBack && <IconButton name="arrow-back" label="Back" onPress={onBack} />}
              <Text style={[s.h2, { flex: 1 }]}>{title}</Text>
              <IconButton name="close" label="Close dialog" onPress={onClose} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 25,
                paddingBottom: 40,
                paddingTop: 8,
                gap: 24,
              }}
            >
              {children}
            </ScrollView>
            {footer && (
              <View
                style={{
                  paddingHorizontal: 25,
                  paddingTop: 12,
                  paddingBottom: 16,
                  borderTopWidth: 1,
                  borderTopColor: C.line,
                  backgroundColor: C.bg,
                }}
              >
                {footer}
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export function Page({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={[
          { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: C.bg },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
export function BottomNav({ active }: { active: string }) {
  return (
    <View
      style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 10, backgroundColor: C.bg }}
    >
      <View style={s.nav}>
        {[
          { name: 'Groups', icon: 'grid-outline', path: '/' },
          { name: 'Profile', icon: 'person-outline', path: '/profile' },
        ].map((i) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i.name}
            accessibilityState={{ selected: i.name === active }}
            key={i.name}
            onPress={() => router.replace(i.path as '/')}
            style={[s.navItem, active === i.name && { backgroundColor: '#365A46' }]}
          >
            <Icon name={i.icon} size={20} color={active === i.name ? C.lime : '#B5C4B6'} />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: active === i.name ? '#F6FAED' : '#B5C4B6',
              }}
            >
              {i.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Top({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  return (
    <View style={s.top}>
      {back && (
        <IconButton name="arrow-back" label="Back to groups" onPress={() => router.replace('/')} />
      )}
      <View style={{ flex: 1, gap: 7 }}>
        <Text style={s.h2}>{title}</Text>
        {subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}
export const s = StyleSheet.create({
  h1: { fontSize: 36, fontWeight: '800', color: C.dark, letterSpacing: -1.5, lineHeight: 44 },
  h2: { fontSize: 26, fontWeight: '800', color: C.dark, letterSpacing: -0.9, lineHeight: 34 },
  h3: { fontSize: 18, fontWeight: '700', color: C.dark, letterSpacing: -0.4 },
  body: { fontSize: 14, color: C.dark, lineHeight: 23 },
  muted: { fontSize: 12, color: C.muted, lineHeight: 19 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: C.muted,
    textTransform: 'uppercase',
  },
  btn: {
    minHeight: 57,
    borderRadius: 19,
    backgroundColor: C.lime,
    borderWidth: 1,
    borderColor: '#D3E991',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 20,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
    textAlign: 'center',
  },
  secondary: { backgroundColor: '#FFFFFF', borderColor: '#E2E7DB' },
  input: {
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: C.dark,
    fontFamily: 'ManropeMedium',
    outlineWidth: 0,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
    maxWidth: '100%',
  },
  error: {
    backgroundColor: '#F8EDE7',
    padding: 15,
    borderRadius: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    padding: 19,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E9EDDF',
    gap: 15,
  },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 7 },
  emptyIcon: {
    width: 95,
    height: 95,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  iconButton: {
    width: 43,
    height: 43,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    flex: 1,
    backgroundColor: '#112B2480',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 620,
    height: '91%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 25,
    paddingVertical: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  top: { padding: 25, paddingTop: 24, flexDirection: 'row', alignItems: 'center', gap: 15 },
  nav: { backgroundColor: C.forest, borderRadius: 24, padding: 7, flexDirection: 'row', gap: 8 },
  navItem: {
    minHeight: 47,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  link: { color: C.accent, fontSize: 12, fontWeight: '700' },
});
