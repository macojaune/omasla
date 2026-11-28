import type { TextInputInstance, ViewStyle } from "react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet"

import type { PublicGroup } from "@omasla/convex"

import type { Bounds, Coordinate, MapFilter } from "~/lib/map-view"
import { Input } from "~/beui/components/input"
import DiscoveryHandle, {
  DISCOVERY_HANDLE_HEIGHT,
} from "~/components/discovery-handle"
import GroupCarousel, { MapMessage } from "~/components/group-carousel"
import GroupDetailPanel from "~/components/group-detail-panel"
import GroupEmblem from "~/components/group-emblem"
import GroupMap from "~/components/group-map"
import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import {
  carouselGroups,
  mapGroups,
  sameBounds,
  searchGroups,
  spotCounts,
} from "~/lib/map-view"
import { daysUntil, nextOuting, outingLabels } from "~/lib/season"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  usePalette,
} from "~/theme/ui"

const SHEET_LEVELS = ["Fiche réduite", "Fiche agrandie"]

/**
 * Home map (P1): spotted groups as coloured plaques, a compact search and the
 * live/seen chips on top, the groups of the current frame in a carousel at the
 * bottom. The bottom sheet only holds a group's sheet.
 */
export default function MapScreen() {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const { width, height: windowHeight, fontScale } = useWindowDimensions()
  // The tab bar sits below this screen: size overlays from the screen itself.
  const [pageHeight, setPageHeight] = useState(0)
  const height = pageHeight || windowHeight
  const wide = width >= 700
  const largeText = fontScale > 1.3
  const router = useRouter()
  const params = useLocalSearchParams<{ groupId?: string }>()
  const catalog = useCatalog()
  const sheet = useRef<BottomSheet>(null)
  const input = useRef<TextInputInstance>(null)
  const mounted = useRef(true)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [filter, setFilter] = useState<MapFilter>("all")
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [relief, setRelief] = useState(true)
  const [selectedId, setSelectedId] = useState<string | undefined>(
    params.groupId,
  )
  const [sheetIndex, setSheetIndex] = useState(params.groupId ? 0 : -1)
  const [contentHeight, setContentHeight] = useState(0)
  const [settledPanel, setSettledPanel] = useState<{
    index: number
    top: number
    layout: string
  } | null>(null)
  const [topBlockHeight, setTopBlockHeight] = useState(0)
  const [bottomBlockHeight, setBottomBlockHeight] = useState(0)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSettings, setLocationSettings] = useState(false)
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null)
  const [camera, setCamera] = useState<{
    kind: "overview" | "user" | "selection"
    id: number
    coordinate?: Coordinate
  }>({ kind: params.groupId ? "selection" : "overview", id: 0 })
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    if (Platform.OS !== "ios") return
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      const docked = event.endCoordinates.width >= width * 0.7
      setKeyboardInset(
        docked ? Math.max(0, windowHeight - event.endCoordinates.screenY) : 0,
      )
    })
    const hide = Keyboard.addListener("keyboardWillHide", () =>
      setKeyboardInset(0),
    )
    return () => {
      change.remove()
      hide.remove()
    }
  }, [windowHeight, width])
  useEffect(() => {
    mounted.current = true
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (mounted.current) setReduceTransparency(value)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    )
    return () => {
      mounted.current = false
      subscription.remove()
    }
  }, [])

  const data = catalog.data
  const selected = data?.groups.find((group) => group.id === selectedId)
  const counts = useMemo(
    () => (data ? spotCounts(data, catalog.now) : null),
    [data, catalog.now],
  )
  const markers = useMemo(
    () => (data ? mapGroups(data, catalog.now, { filter, query: search }) : []),
    [data, catalog.now, filter, search],
  )
  const carousel = useMemo(
    () =>
      data
        ? carouselGroups(markers, data, catalog.now, {
            bounds,
            from: userLocation,
          })
        : [],
    [data, markers, catalog.now, bounds, userLocation],
  )
  const results = useMemo(
    () => (data ? searchGroups(data, catalog.now, search) : []),
    [data, catalog.now, search],
  )
  const mapCatalog = useMemo(() => {
    if (!data) return null
    // The open sheet keeps its group on the map even when filtered out.
    const groups =
      selected && !markers.includes(selected) ? [...markers, selected] : markers
    return { ...data, groups }
  }, [data, markers, selected])
  const showResults = searchFocused && Boolean(search.trim())

  // Sheet geometry: the small snap shows the header, the state and the main action.
  const topInset = insets.top + 12
  const availableHeight = Math.max(160, height - topInset)
  const detailHeight = Math.min(
    availableHeight - 1,
    Math.max(
      220,
      Math.min(
        (contentHeight || 330) + DISCOVERY_HANDLE_HEIGHT + 30,
        availableHeight * 0.62,
      ),
    ),
  )
  const snapPoints = useMemo(
    () => (wide ? ["100%"] : [detailHeight, "100%"]),
    [wide, detailHeight],
  )
  const panelLayout = `${width}:${height}:${fontScale}:${detailHeight}:${topInset}`
  const sheetOpen = Boolean(selectedId) && sheetIndex >= 0
  const activeSnapPoint = snapPoints[sheetIndex] ?? snapPoints[0]
  const occupiedMapBottom =
    sheetOpen && !wide
      ? settledPanel?.layout === panelLayout &&
        settledPanel.index === sheetIndex
        ? height - settledPanel.top
        : typeof activeSnapPoint === "number"
          ? activeSnapPoint
          : availableHeight
      : bottomBlockHeight + 12
  const overlayTop = insets.top + 10
  const controlsTop = overlayTop + (topBlockHeight || 104) + 10
  const overlayWidth: ViewStyle = wide
    ? { left: 16, width: 392 }
    : { left: 16, right: 16 }

  useEffect(() => {
    if (params.groupId) {
      setSelectedId(params.groupId)
      setCamera((value) => ({ kind: "selection", id: value.id + 1 }))
      sheet.current?.snapToIndex(0)
    }
  }, [params.groupId])
  const clearSelection = useCallback(() => {
    setSelectedId(undefined)
    setLocationError(null)
    if (params.groupId) router.setParams({ groupId: undefined })
  }, [params.groupId, router])
  // Closing animates the sheet down; `onClose` then clears the selection.
  const closeSelection = useCallback(() => {
    if (sheetIndex >= 0) sheet.current?.close()
    else clearSelection()
  }, [clearSelection, sheetIndex])
  const renderHandle = useCallback(
    () => (
      <DiscoveryHandle
        index={sheetIndex}
        label="Fiche du groupe"
        levels={wide ? ["Fiche"] : SHEET_LEVELS}
      />
    ),
    [sheetIndex, wide],
  )
  const endSearch = useCallback((clear: boolean) => {
    if (clear) setSearch("")
    setSearchFocused(false)
    input.current?.blur()
    Keyboard.dismiss()
  }, [])
  useFocusEffect(
    useCallback(() => {
      const event = BackHandler.addEventListener("hardwareBackPress", () => {
        if (selectedId) {
          closeSelection()
          return true
        }
        if (searchFocused) {
          endSearch(false)
          return true
        }
        if (search) {
          endSearch(true)
          return true
        }
        if (filter !== "all") {
          setFilter("all")
          return true
        }
        return false
      })
      return () => event.remove()
    }, [selectedId, closeSelection, search, searchFocused, endSearch, filter]),
  )
  function select(group: PublicGroup) {
    endSearch(false)
    setSelectedId(group.id)
    setContentHeight(0)
    setCamera((value) => ({ kind: "selection", id: value.id + 1 }))
    setLocationError(null)
    sheet.current?.snapToIndex(0)
    void Haptics.selectionAsync().catch(() => undefined)
  }
  function overview() {
    setCamera((value) => ({ kind: "overview", id: value.id + 1 }))
  }
  function changeFilter(value: MapFilter) {
    setFilter(value)
    overview()
    void Haptics.selectionAsync().catch(() => undefined)
  }
  const onBoundsChange = useCallback((next: Bounds) => {
    setBounds((value) => (sameBounds(value, next) ? value : next))
  }, [])
  async function locate() {
    if (locating) return
    setLocating(true)
    setLocationError(null)
    setLocationSettings(false)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        if (mounted.current) {
          setLocationSettings(!permission.canAskAgain)
          setLocationError(
            "Autorise la localisation pour te retrouver sur la carte. Les groupes restent consultables.",
          )
        }
        return
      }
      let timeout: ReturnType<typeof setTimeout> | undefined
      const point = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("timeout")), 15_000)
        }),
      ]).finally(() => clearTimeout(timeout))
      if (!mounted.current) return
      const coordinate = {
        latitude: point.coords.latitude,
        longitude: point.coords.longitude,
      }
      setUserLocation(coordinate)
      setCamera((value) => ({ kind: "user", id: value.id + 1, coordinate }))
    } catch {
      if (mounted.current)
        setLocationError(
          "Ta position n’a pas pu être obtenue. Réessaie à l’extérieur ou vérifie les réglages de localisation.",
        )
    } finally {
      if (mounted.current) setLocating(false)
    }
  }
  const material = (children: React.ReactNode, style?: ViewStyle) => (
    <View
      style={[
        s.material,
        {
          backgroundColor:
            Platform.OS === "ios" && !reduceTransparency
              ? "transparent"
              : c.surface,
        },
        style,
      ]}
    >
      {Platform.OS === "ios" && !reduceTransparency && (
        <BlurView
          intensity={70}
          tint={c.isDark ? "systemMaterialDark" : "systemMaterialLight"}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: style?.borderRadius ?? 20, overflow: "hidden" },
          ]}
        />
      )}
      {children}
    </View>
  )
  const chip = (value: "live" | "seen", text: string, count: number) => {
    const active = filter === value
    const disabled = !active && count === 0
    return (
      <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityLabel={`${text} · ${count}`}
        accessibilityState={{ selected: active, disabled }}
        accessibilityHint={
          active
            ? "Touche pour revoir tous les groupes repérés."
            : "Touche pour n’afficher que ces groupes."
        }
        disabled={disabled}
        onPress={() => changeFilter(active ? "all" : value)}
        style={({ pressed }) => [
          s.chip,
          {
            backgroundColor: active ? c.ink : c.surface,
            shadowOpacity: c.isDark ? 0.3 : 0.12,
            opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {value === "live" && (
          <View
            style={[
              s.chipDot,
              { backgroundColor: active ? "#3DDC84" : c.success },
            ]}
          />
        )}
        <Label
          maxFontSizeMultiplier={1.6}
          style={[s.chipLabel, { color: active ? c.surface : c.ink }]}
        >
          {text} · {count}
        </Label>
      </Pressable>
    )
  }

  const outing = nextOuting(new Date(catalog.now))
  const outingDays = daysUntil(new Date(catalog.now), outing.date)
  const bottomContent = (() => {
    if (!data) {
      if (!catalog.loaded) return null
      return (
        <MapMessage
          title={
            catalog.offline
              ? "Une connexion pour commencer"
              : "Les groupes n’ont pas pu être chargés"
          }
        >
          <Label muted style={s.messageText}>
            {catalog.offline
              ? "Charge la carte une première fois pour la retrouver ensuite hors ligne."
              : "Réessaie dans un instant."}
          </Label>
          <Button
            title="Actualiser"
            variant="secondary"
            disabled={catalog.offline}
            onPress={catalog.refresh}
          />
        </MapMessage>
      )
    }
    if (!counts?.spotted)
      return (
        <MapMessage title="Aucun groupe repéré pour l’instant">
          <Label muted style={s.messageText}>
            {outingDays === 0
              ? "C’est soir de sortie : les groupes apparaîtront ici dès leur premier point."
              : // In season, outings are never more than six days apart.
                `${outingDays > 6 ? "Hors saison. " : ""}Prochaine sortie : ${outingLabels[outing.kind]} ${outing.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: outingDays > 6 ? "numeric" : undefined })}. Les groupes apparaîtront ici dès qu’ils seront repérés.`}
          </Label>
          <Button
            title="Voir Ce soir"
            icon="tonight"
            variant="secondary"
            onPress={() => router.navigate("/ce-soir")}
          />
        </MapMessage>
      )
    if (!markers.length)
      return (
        <MapMessage
          title={
            search.trim()
              ? "Aucun groupe repéré à ce nom"
              : filter === "live"
                ? "Aucun groupe en direct"
                : "Aucun groupe vu récemment"
          }
        >
          <Button
            title={`Voir les groupes repérés · ${counts.spotted}`}
            variant="secondary"
            onPress={() => {
              setSearch("")
              changeFilter("all")
            }}
          />
        </MapMessage>
      )
    if (!carousel.length)
      return (
        <MapMessage title="Aucun groupe dans ce cadre">
          <Button
            title={`Voir ${markers.length > 1 ? `les ${markers.length} groupes` : "le groupe"} sur la carte`}
            icon="overview"
            variant="secondary"
            onPress={overview}
          />
        </MapMessage>
      )
    return (
      <GroupCarousel
        items={carousel}
        catalog={data}
        now={catalog.now}
        width={wide ? Math.min(width, 720) : width}
        largeText={largeText}
        onSelect={select}
      />
    )
  })()

  return (
    <View
      onLayout={(event) =>
        setPageHeight(Math.round(event.nativeEvent.layout.height))
      }
      style={[s.page, { backgroundColor: c.background }]}
    >
      {mapCatalog ? (
        <GroupMap
          catalog={mapCatalog}
          now={catalog.now}
          selectedId={selectedId}
          selectionReady={wide || sheetIndex >= 0}
          cameraReady={
            wide ||
            camera.id === 0 ||
            camera.kind !== "selection" ||
            sheetIndex >= 0
          }
          onSelect={select}
          bottomInset={occupiedMapBottom}
          leftInset={wide && selectedId ? 420 : 0}
          cameraRequest={camera}
          userLocation={userLocation}
          onBoundsChange={onBoundsChange}
          relief={relief}
          onReliefChange={setRelief}
          onPan={() => {
            if (searchFocused) endSearch(false)
          }}
          onMapPress={() => {
            if (searchFocused) endSearch(false)
          }}
        />
      ) : (
        <View style={s.mapLoading}>
          <Icon name="map" color={c.muted} size={42} />
          <Label muted>La carte se prépare…</Label>
        </View>
      )}

      {/* Map controls, grouped: overview, my position, flat/relief. */}
      <View pointerEvents="box-none" style={[s.controls, { top: controlsTop }]}>
        {material(
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                search || filter !== "all"
                  ? "Vue d’ensemble des résultats"
                  : "Voir tous les groupes repérés sur la carte"
              }
              onPress={overview}
              style={s.control}
            >
              <Icon name="overview" color={c.ink} size={20} />
            </Pressable>
            <View style={[s.divider, { backgroundColor: c.line }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Me localiser sur la carte"
              accessibilityState={{ busy: locating, disabled: locating }}
              disabled={locating}
              onPress={() => void locate()}
              style={s.control}
            >
              {locating ? (
                <LoadingIndicator />
              ) : (
                <Icon
                  name="crosshair"
                  color={userLocation ? c.primary : c.ink}
                  size={22}
                />
              )}
            </Pressable>
            <View style={[s.divider, { backgroundColor: c.line }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                relief
                  ? "Passer à la carte à plat"
                  : "Afficher les bâtiments en relief"
              }
              onPress={() => setRelief((value) => !value)}
              style={s.control}
            >
              <Label
                maxFontSizeMultiplier={1.4}
                style={{ fontSize: 14, lineHeight: 18, fontWeight: "700" }}
              >
                {relief ? "2D" : "3D"}
              </Label>
            </Pressable>
          </View>,
          { borderRadius: 18 },
        )}
      </View>

      {locationError && (
        <View
          style={[
            s.locationError,
            {
              top: controlsTop,
              left: 16,
              right: 84,
              maxWidth: wide ? 392 : undefined,
            },
          ]}
        >
          <Notice tone="warning">{locationError}</Notice>
          {locationSettings && (
            <Button
              title="Ouvrir les réglages"
              variant="secondary"
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          )}
          <Button
            title="Fermer"
            variant="secondary"
            onPress={() => setLocationError(null)}
          />
        </View>
      )}

      {/* Bottom: carousel of the frame, or the empty state. */}
      {(!sheetOpen || wide) && !showResults && (
        <View
          pointerEvents="box-none"
          onLayout={(event) =>
            setBottomBlockHeight(Math.round(event.nativeEvent.layout.height))
          }
          style={[
            s.bottom,
            wide
              ? { left: selectedId ? 424 : 0, right: 0, maxWidth: 760 }
              : { left: 0, right: 0 },
          ]}
        >
          {bottomContent}
        </View>
      )}

      {/* Top: compact search, then the chips. */}
      <View
        pointerEvents="box-none"
        style={[s.top, overlayWidth, { top: overlayTop }]}
      >
        <View
          pointerEvents="box-none"
          onLayout={(event) =>
            setTopBlockHeight(Math.round(event.nativeEvent.layout.height))
          }
          style={{ gap: 8 }}
        >
          <View style={[s.material, s.search]}>
            <Input
              ref={input}
              value={search}
              onChangeText={setSearch}
              placeholder="Chercher un groupe"
              placeholderTextColor={c.muted}
              accessibilityLabel="Chercher un groupe"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              fieldHeight={48}
              classNames={{ field: "bg-surface", input: "min-w-0 ps-11" }}
              leftIcon={<Icon name="search" color={c.muted} size={19} />}
              rightIcon={
                search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Effacer la recherche"
                    onPress={() => {
                      setSearch("")
                      input.current?.focus()
                    }}
                    style={s.searchAction}
                  >
                    <Icon name="close" color={c.muted} size={16} />
                  </Pressable>
                ) : undefined
              }
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => {
                endSearch(false)
                overview()
              }}
            />
          </View>
          {!showResults && counts && (
            <View pointerEvents="box-none" style={s.chips}>
              {chip("live", "En direct", counts.live)}
              {chip("seen", "Vus récemment", counts.seen)}
            </View>
          )}
          {!showResults && catalog.offline && (
            <Notice tone="warning" style={s.compactNotice}>
              Hors ligne
              {catalog.savedAt
                ? ` · données de ${new Date(catalog.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
              . Les positions sont datées.
            </Notice>
          )}
          {!showResults && catalog.error && !catalog.offline && (
            <Notice tone="warning" style={s.compactNotice}>
              {catalog.error}
            </Notice>
          )}
        </View>
        {showResults && data && (
          <View
            style={[
              s.results,
              {
                backgroundColor: c.surface,
                maxHeight: Math.max(
                  160,
                  windowHeight -
                    overlayTop -
                    (topBlockHeight || 56) -
                    keyboardInset -
                    (Platform.OS === "ios" && keyboardInset ? 24 : 120),
                ),
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingHorizontal: 18 }}
            >
              {results.length ? (
                results.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    catalog={data}
                    now={catalog.now}
                    onPress={() => select(group)}
                  />
                ))
              ) : (
                <View style={{ paddingVertical: 18, gap: 4 }}>
                  <Label style={{ fontWeight: "600" }}>
                    Aucun groupe à ce nom
                  </Label>
                  <Label muted style={s.messageText}>
                    Essaie un autre nom, ou retrouve l’annuaire dans l’onglet
                    Groupes.
                  </Label>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* The sheet now only holds a group's card. */}
      <View
        pointerEvents="box-none"
        style={
          wide
            ? [s.sidebar, { top: controlsTop, bottom: 16 }]
            : StyleSheet.absoluteFill
        }
      >
        <BottomSheet
          ref={sheet}
          index={params.groupId ? 0 : -1}
          snapPoints={snapPoints}
          topInset={wide ? 0 : topInset}
          accessible={false}
          handleComponent={renderHandle}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose
          animateOnMount={false}
          onClose={clearSelection}
          onChange={(index, position) => {
            setSheetIndex(index)
            setSettledPanel({
              index,
              top: position + (wide ? 0 : topInset),
              layout: panelLayout,
            })
          }}
          backgroundStyle={{ backgroundColor: c.surface, borderRadius: 28 }}
          style={{
            shadowColor: "#14253D",
            shadowOpacity: c.isDark ? 0.3 : 0.13,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: -3 },
            elevation: 12,
          }}
        >
          {selectedId ? (
            <BottomSheetScrollView
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 30,
              }}
            >
              <View
                onLayout={(event) =>
                  setContentHeight(Math.ceil(event.nativeEvent.layout.height))
                }
                style={s.detail}
              >
                <View style={s.heading}>
                  {selected && <GroupEmblem group={selected} size={48} />}
                  <Label
                    accessibilityRole="header"
                    style={[s.title, { flex: 1 }]}
                  >
                    {selected?.title.replace(/ · démo$/, "") ?? "Groupe"}
                  </Label>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fermer la fiche du groupe"
                    onPress={closeSelection}
                    style={({ pressed }) => [
                      s.round,
                      {
                        backgroundColor: c.background,
                        opacity: pressed ? 0.65 : 1,
                      },
                    ]}
                  >
                    <Icon name="close" color={c.muted} size={17} />
                  </Pressable>
                </View>
                {catalog.offline && (
                  <Notice tone="warning">
                    Hors ligne. Les positions sont datées.
                  </Notice>
                )}
                {selected && data ? (
                  <GroupDetailPanel
                    key={selected.id}
                    group={selected}
                    catalog={data}
                    now={catalog.now}
                    offline={catalog.offline}
                    canWrite={catalog.canWrite}
                    userLocation={userLocation}
                  />
                ) : catalog.loaded ? (
                  <Notice>
                    Ce groupe n’est plus disponible.{" "}
                    <Label
                      onPress={closeSelection}
                      style={{ color: c.primary }}
                    >
                      Revenir à la carte
                    </Label>
                  </Notice>
                ) : (
                  <LoadingIndicator />
                )}
              </View>
            </BottomSheetScrollView>
          ) : (
            <View />
          )}
        </BottomSheet>
      </View>
    </View>
  )
}
const s = StyleSheet.create({
  page: { flex: 1 },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  material: {
    shadowColor: "#172B46",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  top: { position: "absolute", gap: 8 },
  search: { borderRadius: 24 },
  searchAction: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    shadowColor: "#172B46",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  chipDot: { width: 9, height: 9, borderRadius: 5 },
  chipLabel: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  compactNotice: { paddingVertical: 10, paddingHorizontal: 14 },
  results: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#172B46",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  bottom: { position: "absolute", bottom: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: {
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: "700",
  },
  detail: { gap: 16, paddingTop: 6 },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  controls: { position: "absolute", right: 16, width: 52 },
  control: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  sidebar: { position: "absolute", left: 16, width: 392 },
  locationError: { position: "absolute", gap: 6 },
})
