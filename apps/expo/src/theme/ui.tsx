import type { PropsWithChildren } from "react"
import type { StyleProp, TextProps, ViewStyle } from "react-native"
import {
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
} from "react-native"
import { SymbolView } from "expo-symbols"

import { Alert, AlertContent, AlertIcon } from "~/beui/components/alert"
import { ButtonRoot } from "~/beui/components/button/button"
import { Loader } from "~/beui/components/loader"

const day = {
  isDark: false,
  accent: "#E2381F",
  background: "#EFE8DC",
  surface: "#FBF8F3",
  ink: "#1F2124",
  muted: "#6B6660",
  line: "#E3DACB",
  primary: "#5A1CEB",
  primarySoft: "#ECE5FF",
  primaryText: "#ffffff",
  success: "#15784A",
  successSoft: "#E3F3EA",
  warning: "#8A4E06",
  warningSoft: "#FBEBD3",
  danger: "#C42E18",
}
const night = {
  isDark: true,
  accent: "#FF7A62",
  background: "#16141B",
  surface: "#221F28",
  ink: "#F3EEE6",
  muted: "#B5ADA2",
  line: "#3A3541",
  primary: "#AE93FF",
  primarySoft: "#2D2450",
  primaryText: "#16141B",
  success: "#7DD3A8",
  successSoft: "#173B2C",
  warning: "#EBBD72",
  warningSoft: "#3E2E17",
  danger: "#FF9A87",
}
export function usePalette() {
  return useColorScheme() === "dark" ? night : day
}
const symbols = {
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  map: { ios: "map", android: "map", web: "map" },
  list: { ios: "list.bullet", android: "list", web: "list" },
  arrow: { ios: "arrow.up.right", android: "north_east", web: "north_east" },
  back: { ios: "chevron.left", android: "arrow_back", web: "arrow_back" },
  pin: {
    ios: "mappin.and.ellipse",
    android: "location_on",
    web: "location_on",
  },
  clock: { ios: "clock", android: "schedule", web: "schedule" },
  person: {
    ios: "person.crop.circle",
    android: "account_circle",
    web: "account_circle",
  },
  close: { ios: "xmark", android: "close", web: "close" },
  signal: {
    ios: "dot.radiowaves.left.and.right",
    android: "sensors",
    web: "sensors",
  },
  check: { ios: "checkmark", android: "check", web: "check" },
  refresh: { ios: "arrow.clockwise", android: "refresh", web: "refresh" },
  crosshair: { ios: "location", android: "my_location", web: "my_location" },
  stop: { ios: "stop.fill", android: "stop", web: "stop" },
  walk: {
    ios: "figure.walk",
    android: "directions_walk",
    web: "directions_walk",
  },
  chevron: {
    ios: "chevron.right",
    android: "chevron_right",
    web: "chevron_right",
  },
  down: { ios: "chevron.down", android: "expand_more", web: "expand_more" },
  expand: { ios: "chevron.up", android: "expand_less", web: "expand_less" },
  overview: {
    ios: "arrow.up.left.and.arrow.down.right",
    android: "zoom_out_map",
    web: "zoom_out_map",
  },
  info: { ios: "info.circle", android: "info", web: "info" },
  offline: { ios: "wifi.slash", android: "wifi_off", web: "wifi_off" },
  plus: { ios: "plus", android: "add", web: "add" },
  tonight: { ios: "moon.stars", android: "bedtime", web: "bedtime" },
  groups: { ios: "person.3", android: "groups", web: "groups" },
  mail: { ios: "envelope", android: "mail", web: "mail" },
} as const
export type IconName = keyof typeof symbols
export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName
  color: string
  size?: number
}) {
  return (
    <SymbolView
      name={symbols[name]}
      tintColor={color}
      size={size}
      weight="medium"
      style={{ width: size, height: size }}
    />
  )
}
export function Label({
  children,
  style,
  muted = false,
  ...props
}: PropsWithChildren<TextProps & { muted?: boolean }>) {
  const c = usePalette()
  const { fontScale } = useWindowDimensions()
  return (
    <Text
      // Remeasure native text when Dynamic Type changes while the app is open.
      key={fontScale}
      {...props}
      style={[styles.body, { color: muted ? c.muted : c.ink }, style]}
    >
      {children}
    </Text>
  )
}
export function LoadingIndicator({
  color,
  size = 24,
}: {
  color?: string
  size?: number
}) {
  const c = usePalette()
  return (
    <Loader
      variant="spinner"
      label="Chargement en cours"
      size={size}
      color={color ?? c.primary}
    />
  )
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  icon,
  testID,
}: {
  title: string
  onPress: () => void
  variant?: "primary" | "secondary" | "danger"
  disabled?: boolean
  busy?: boolean
  icon?: IconName
  testID?: string
}) {
  const c = usePalette()
  const { fontScale } = useWindowDimensions()
  const color =
    variant === "primary"
      ? c.primaryText
      : variant === "danger"
        ? c.danger
        : c.ink
  return (
    <ButtonRoot
      className="self-stretch"
      pressScale={0.975}
      testID={testID}
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: variant === "primary" ? c.primary : c.primarySoft,
          borderColor: variant === "primary" ? c.primary : c.line,
        },
      ]}
    >
      {busy ? (
        <LoadingIndicator size={18} color={color} />
      ) : icon ? (
        <Icon name={icon} color={color} size={20} />
      ) : null}
      <Text key={fontScale} style={[styles.buttonText, { color }]}>
        {title}
      </Text>
    </ButtonRoot>
  )
}
export function Notice({
  children,
  tone = "normal",
  style,
}: PropsWithChildren<{
  tone?: "normal" | "warning" | "error"
  style?: StyleProp<ViewStyle>
}>) {
  const c = usePalette()
  return (
    <Alert
      variant={
        tone === "error"
          ? "destructive"
          : tone === "warning"
            ? "warning"
            : "info"
      }
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        { backgroundColor: tone === "warning" ? c.warningSoft : c.primarySoft },
        style,
      ]}
    >
      <AlertIcon />
      <AlertContent>
        <Label
          style={{
            color:
              tone === "warning"
                ? c.warning
                : tone === "error"
                  ? c.danger
                  : c.ink,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          {children}
        </Label>
      </AlertContent>
    </Alert>
  )
}
export const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 25 },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  heading: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  page: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 20,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "center",
  },
  notice: { padding: 16, borderRadius: 12 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  section: { gap: 12 },
})
