import type { BottomSheetFlatListMethods } from "@gorhom/bottom-sheet"
import type { TextInputInstance, ViewStyle } from "react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BlurView } from "expo-blur"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet"

import type { PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import { Input } from "~/beui/components/input"
import { Tabs, TabsList, TabsTrigger } from "~/beui/components/tabs"
import DiscoveryHandle, {
  DISCOVERY_HANDLE_HEIGHT,
} from "~/components/discovery-handle"
import GroupDetailPanel from "~/components/group-detail-panel"
import GroupEmblem from "~/components/group-emblem"
import GroupMap from "~/components/group-map"
import GroupRow from "~/components/group-row"
import { useCatalog } from "~/lib/catalog"
import { normalizeSearch, visiblePosition } from "~/lib/catalog-model"
import {
  Button,
  Icon,
  Label,
  LoadingIndicator,
  Notice,
  usePalette,
} from "~/theme/ui"

export default function Discovery() {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const { width, height: windowHeight, fontScale } = useWindowDimensions()
  // The tab bar sits below this screen: size the panel from the screen itself.
  const [pageHeight, setPageHeight] = useState(0)
  const height = pageHeight || windowHeight
  const wide = width >= 700
  const largeText = fontScale > 1.3
  const router = useRouter()
  const params = useLocalSearchParams<{ groupId?: string }>()
  const catalog = useCatalog()
  const sheet = useRef<BottomSheet>(null)
  const input = useRef<TextInputInstance>(null)
  const groupList = useRef<BottomSheetFlatListMethods>(null)
  const savedListOffset = useRef(0)
  const restoreListOffset = useRef(false)
  const listReady = useRef(false)
  const listPanelIndex = useRef(1)
  const mounted = useRef(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "live">("all")
  const [selectedId, setSelectedId] = useState<string | undefined>(
    params.groupId,
  )
  const [sheetIndex, setSheetIndex] = useState(1)
  const [detailHeadingHeight, setDetailHeadingHeight] = useState(0)
  const [settledPanel, setSettledPanel] = useState<{
    index: number
    top: number
    layout: string
  } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSettings, setLocationSettings] = useState(false)
  const [userLocation, setUserLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [camera, setCamera] = useState<{
    kind: "overview" | "user" | "selection"
    id: number
    coordinate?: { latitude: number; longitude: number }
  }>({ kind: params.groupId ? "selection" : "overview", id: 0 })
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    if (Platform.OS !== "ios") return
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      Keyboard.scheduleLayoutAnimation(event)
      const docked = event.endCoordinates.width >= width * 0.7
      setKeyboardInset(
        docked ? Math.max(0, height - event.endCoordinates.screenY) : 0,
      )
    })
    const hide = Keyboard.addListener("keyboardWillHide", (event) => {
      Keyboard.scheduleLayoutAnimation(event)
      setKeyboardInset(0)
    })
    return () => {
      change.remove()
      hide.remove()
    }
  }, [height, width])
  const panelPosition = useSharedValue(height - 350)
  const selected = catalog.data?.groups.find((group) => group.id === selectedId)
  const topInset = insets.top + 12
  const availableHeight = Math.max(120, height - topInset - keyboardInset)
  const compactHeight = Math.min(112, availableHeight - 32)
  const listHeight = Math.max(
    compactHeight + 24,
    Math.min(availableHeight * 0.6, 386),
  )
  const detailHeight = Math.min(
    availableHeight - 1,
    Math.max(
      compactHeight + 24,
      Math.min(availableHeight * 0.6, 350),
      detailHeadingHeight + DISCOVERY_HANDLE_HEIGHT + 12,
    ),
  )
  const middleHeight = selected ? detailHeight : listHeight
  const snapPoints = useMemo(
    () => (wide ? ["100%"] : [compactHeight, middleHeight, "100%"]),
    [wide, compactHeight, middleHeight],
  )
  const panelLayout = `${width}:${height}:${fontScale}:${keyboardInset}:${compactHeight}:${middleHeight}:${topInset}`
  const activeSnapPoint = snapPoints[sheetIndex] ?? snapPoints[1]
  const occupiedMapBottom = wide
    ? 20
    : settledPanel?.layout === panelLayout && settledPanel.index === sheetIndex
      ? height - settledPanel.top
      : keyboardInset +
        (typeof activeSnapPoint === "number"
          ? activeSnapPoint
          : availableHeight)
  const controlStyle = useAnimatedStyle(() => ({
    top: Math.max(topInset + 42, panelPosition.value - 120),
  }))
  const collapsed = !wide && sheetIndex === 0 && keyboardInset === 0
  const renderHandle = useCallback(
    () => <DiscoveryHandle index={sheetIndex} />,
    [sheetIndex],
  )
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
  useEffect(() => {
    if (params.groupId) {
      setSelectedId(params.groupId)
      setCamera((value) => ({ kind: "selection", id: value.id + 1 }))
      sheet.current?.snapToIndex(wide ? 0 : 1)
    }
  }, [params.groupId, wide])
  const closeSelection = useCallback(() => {
    restoreListOffset.current = true
    setSelectedId(undefined)
    if (params.groupId) router.setParams({ groupId: undefined })
    setLocationError(null)
    sheet.current?.snapToIndex(wide ? 0 : listPanelIndex.current)
  }, [params.groupId, router, wide])
  const beginSearch = () => {
    setSelectedId(undefined)
    if (params.groupId) router.setParams({ groupId: undefined })
    sheet.current?.snapToIndex(wide ? 0 : 2)
  }
  useFocusEffect(
    useCallback(() => {
      const event = BackHandler.addEventListener("hardwareBackPress", () => {
        if (selectedId) {
          closeSelection()
          return true
        }
        if (search) {
          setSearch("")
          Keyboard.dismiss()
          sheet.current?.snapToIndex(wide ? 0 : 1)
          return true
        }
        if (!wide && sheetIndex > 0) {
          sheet.current?.snapToIndex(0)
          return true
        }
        return false
      })
      return () => event.remove()
    }, [selectedId, closeSelection, search, sheetIndex, wide]),
  )
  const data = catalog.data
  const groups = useMemo(() => {
    if (!data) return []
    const query = normalizeSearch(search)
    return data.groups
      .filter(
        (group) =>
          normalizeSearch(group.title).includes(query) &&
          (filter === "all" ||
            (group.live &&
              group.position?.source === "referent" &&
              positionFreshness(group.position, data.policy, catalog.now) ===
                "recent")),
      )
      .sort(
        (a, b) =>
          Number(Boolean(visiblePosition(b, data, catalog.now))) -
            Number(Boolean(visiblePosition(a, data, catalog.now))) ||
          a.title.localeCompare(b.title, "fr"),
      )
  }, [data, search, filter, catalog.now])
  useEffect(() => {
    savedListOffset.current = 0
    restoreListOffset.current = false
    groupList.current?.scrollToOffset({ offset: 0, animated: false })
  }, [search, filter])
  const mapCatalog = useMemo(
    () => (data ? { ...data, groups } : null),
    [data, groups],
  )
  function select(group: PublicGroup) {
    if (!selectedId) listPanelIndex.current = sheetIndex
    listReady.current = false
    Keyboard.dismiss()
    setSelectedId(group.id)
    setCamera((value) => ({ kind: "selection", id: value.id + 1 }))
    setLocationError(null)
    sheet.current?.snapToIndex(wide ? 0 : 1)
    void Haptics.selectionAsync().catch(() => undefined)
  }
  function restoreListScroll(index: number) {
    if (!restoreListOffset.current || !listReady.current || !groupList.current)
      return
    if (!wide && index !== 2) {
      if (listPanelIndex.current !== 2) restoreListOffset.current = false
      return
    }
    groupList.current.scrollToOffset({
      offset: savedListOffset.current,
      animated: false,
    })
    restoreListOffset.current = false
  }
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
      sheet.current?.snapToIndex(0)
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
  const heading = (
    <View style={s.heading}>
      {selected && <GroupEmblem group={selected} size={48} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Label
          accessibilityRole="header"
          style={{
            fontSize: selected ? 25 : 26,
            lineHeight: 32,
            letterSpacing: -0.6,
            fontWeight: "700",
          }}
        >
          {selected?.title.replace(/ · démo$/, "") ??
            (search ? "Résultats" : largeText ? "Groupes" : "Les groupes")}
        </Label>
        {!selected && (!largeText || Boolean(search)) && (
          <Label muted style={{ fontSize: 14, lineHeight: 20 }}>
            {search
              ? `${groups.length} groupe${groups.length > 1 ? "s" : ""} trouvé${groups.length > 1 ? "s" : ""}`
              : "Retrouve-les sur la carte"}
          </Label>
        )}
      </View>
      {(Boolean(selected) || !wide) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            selected ? "Fermer la fiche du groupe" : "Voir la carte"
          }
          onPress={() => {
            if (selected) closeSelection()
            else {
              Keyboard.dismiss()
              sheet.current?.snapToIndex(0)
            }
          }}
          style={({ pressed }) => [
            selected ? s.round : s.namedAction,
            { backgroundColor: c.background, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Icon name={selected ? "close" : "map"} color={c.muted} size={17} />
          {!selected && (
            <Label maxFontSizeMultiplier={1.6} style={s.actionLabel}>
              Carte
            </Label>
          )}
        </Pressable>
      )}
    </View>
  )
  const notices = (
    <>
      {catalog.offline && (
        <Notice tone="warning">
          Hors ligne
          {catalog.savedAt
            ? ` · données de ${new Date(catalog.savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
          . Les positions sont datées.
        </Notice>
      )}
      {catalog.error && <Notice tone="warning">{catalog.error}</Notice>}
      {selectedId && !selected && catalog.loaded && (
        <Notice>
          Ce groupe n’est plus disponible.{" "}
          <Label onPress={closeSelection} style={{ color: c.primary }}>
            Voir les groupes
          </Label>
        </Notice>
      )}
    </>
  )
  const listHeader = (
    <View style={s.listHeader}>
      {heading}
      {notices}
      <Tabs
        value={filter}
        onValueChange={(value) => {
          if (value !== "all" && value !== "live") return
          setFilter(value)
          sheet.current?.snapToIndex(wide ? 0 : 1)
        }}
      >
        <TabsList className="bg-background">
          <TabsTrigger value="all" className="min-h-11">
            Tous les groupes
          </TabsTrigger>
          <TabsTrigger
            value="live"
            className="min-h-11"
            accessibilityLabel="Groupes en direct"
            icon={({ color, size }) => (
              <Icon
                name="signal"
                color={String(color ?? c.muted)}
                size={size}
              />
            )}
          >
            En direct
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </View>
  )
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
          selectionReady={wide || sheetIndex === 1}
          cameraReady={
            wide ||
            camera.id === 0 ||
            (camera.kind === "selection" ? sheetIndex === 1 : sheetIndex === 0)
          }
          onSelect={select}
          bottomInset={occupiedMapBottom}
          leftInset={wide ? 420 : 0}
          cameraRequest={camera}
          userLocation={userLocation}
          onPan={() => Keyboard.dismiss()}
          onMapPress={() => {
            Keyboard.dismiss()
            if (!wide) sheet.current?.snapToIndex(0)
          }}
        />
      ) : (
        <View style={s.mapLoading}>
          <Icon name="map" color={c.muted} size={42} />
          <Label muted>La carte se prépare…</Label>
        </View>
      )}
      <Animated.View
        pointerEvents="box-none"
        style={[s.controls, wide ? { top: insets.top + 64 } : controlStyle]}
      >
        {material(
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                search || filter !== "all"
                  ? "Vue d’ensemble des résultats"
                  : "Voir tous les groupes sur la carte"
              }
              onPress={() => {
                setCamera((value) => ({ kind: "overview", id: value.id + 1 }))
                Keyboard.dismiss()
                sheet.current?.snapToIndex(0)
              }}
              style={s.control}
            >
              <Icon name="overview" color={c.ink} size={20} />
            </Pressable>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: c.line,
                marginHorizontal: 14,
              }}
            />
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
          </View>,
          { borderRadius: 18 },
        )}
      </Animated.View>
      {locationError && (
        <View
          style={[
            s.locationError,
            { top: insets.top + 16, left: wide ? 436 : 16, right: 82 },
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
      <View
        pointerEvents="box-none"
        style={
          wide
            ? [
                s.sidebar,
                {
                  top: topInset,
                  bottom: Math.max(16, keyboardInset),
                },
              ]
            : StyleSheet.absoluteFill
        }
      >
        <BottomSheet
          ref={sheet}
          index={wide ? 0 : 1}
          snapPoints={snapPoints}
          topInset={wide ? 0 : topInset}
          accessible={false}
          handleComponent={renderHandle}
          bottomInset={wide ? 0 : keyboardInset}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose={false}
          animateOnMount={false}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          enableBlurKeyboardOnGesture
          animatedPosition={panelPosition}
          onAnimate={(fromIndex, toIndex) => {
            if (toIndex < fromIndex) Keyboard.dismiss()
          }}
          onChange={(index, position) => {
            setSheetIndex(index)
            setSettledPanel({
              index,
              top: position + (wide ? 0 : topInset),
              layout: panelLayout,
            })
            restoreListScroll(index)
          }}
          backgroundStyle={{ backgroundColor: c.surface, borderRadius: 28 }}
          handleIndicatorStyle={{
            backgroundColor: c.line,
            width: 36,
            height: 5,
          }}
          handleStyle={{ paddingTop: 11, paddingBottom: 8 }}
          style={{
            shadowColor: "#14253D",
            shadowOpacity: c.isDark ? 0.3 : 0.13,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: -3 },
            elevation: 12,
          }}
        >
          {collapsed ? (
            <View style={s.searchContainer}>
              <Button
                title="Groupes"
                icon="list"
                variant="secondary"
                onPress={() => {
                  if (selectedId) {
                    listPanelIndex.current = 1
                    closeSelection()
                  } else {
                    sheet.current?.snapToIndex(1)
                  }
                }}
              />
            </View>
          ) : !selected ? (
            <View style={s.searchContainer}>
              <Input
                ref={input}
                value={search}
                onChangeText={setSearch}
                placeholder="Chercher un groupe"
                placeholderTextColor={c.muted}
                accessibilityLabel="Rechercher un groupe"
                onFocus={beginSearch}
                fieldHeight={56}
                classNames={{ field: "bg-background", input: "min-w-0 ps-12" }}
                leftIcon={<Icon name="search" color={c.muted} size={21} />}
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
                  Keyboard.dismiss()
                  sheet.current?.snapToIndex(wide ? 0 : 1)
                }}
              />
            </View>
          ) : null}
          {selected && data ? (
            <BottomSheetScrollView
              style={{ opacity: collapsed ? 0 : 1 }}
              pointerEvents={collapsed ? "none" : "auto"}
              accessibilityElementsHidden={collapsed}
              importantForAccessibility={
                collapsed ? "no-hide-descendants" : "auto"
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 30,
              }}
            >
              <View
                onLayout={(event) =>
                  setDetailHeadingHeight(
                    Math.ceil(event.nativeEvent.layout.height),
                  )
                }
                style={s.detailHeader}
              >
                {heading}
                {!selected.live && (
                  <>
                    <Button
                      title="Partager sa position ici"
                      icon="pin"
                      disabled={!selected.canObserve || !catalog.canWrite}
                      onPress={() =>
                        router.push({
                          pathname: "/observe",
                          params: { groupId: selected.id },
                        })
                      }
                    />
                    {catalog.offline && (
                      <Label muted style={s.contributionHint}>
                        Reconnecte-toi pour partager une position.
                      </Label>
                    )}
                  </>
                )}
              </View>
              {notices}
              <GroupDetailPanel
                key={selected.id}
                group={selected}
                catalog={data}
                now={catalog.now}
                offline={catalog.offline}
              />
            </BottomSheetScrollView>
          ) : (
            <BottomSheetFlatList<PublicGroup>
              ref={groupList}
              style={{ opacity: collapsed ? 0 : 1 }}
              pointerEvents={collapsed ? "none" : "auto"}
              accessibilityElementsHidden={collapsed}
              importantForAccessibility={
                collapsed ? "no-hide-descendants" : "auto"
              }
              onScrollEndDrag={(event) => {
                if (!restoreListOffset.current)
                  savedListOffset.current = event.nativeEvent.contentOffset.y
              }}
              onMomentumScrollEnd={(event) => {
                if (!restoreListOffset.current)
                  savedListOffset.current = event.nativeEvent.contentOffset.y
              }}
              onContentSizeChange={() => {
                listReady.current = true
                restoreListScroll(sheetIndex)
              }}
              keyboardDismissMode="on-drag"
              data={groups}
              keyExtractor={(group) => group.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={listHeader}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 24,
              }}
              renderItem={({ item }) =>
                data ? (
                  <GroupRow
                    group={item}
                    catalog={data}
                    now={catalog.now}
                    onPress={() => select(item)}
                  />
                ) : null
              }
              refreshing={catalog.refreshing}
              onRefresh={catalog.offline ? undefined : catalog.refresh}
              ListFooterComponent={
                groups.length ? (
                  <Label
                    muted
                    style={{ fontSize: 12, lineHeight: 18, paddingTop: 20 }}
                  >
                    Tous les groupes sont référencés. Leur présence ici ne
                    garantit pas un suivi aujourd’hui.
                  </Label>
                ) : undefined
              }
              ListEmptyComponent={
                <View style={{ gap: 14, paddingVertical: 28 }}>
                  {!catalog.loaded ? (
                    <>
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          style={{
                            height: 62,
                            borderRadius: 12,
                            backgroundColor: c.background,
                          }}
                        />
                      ))}
                      <Label muted>Chargement des groupes…</Label>
                    </>
                  ) : (
                    <>
                      <Label
                        style={{
                          fontSize: 19,
                          lineHeight: 25,
                          fontWeight: "600",
                        }}
                      >
                        {search
                          ? "Aucun groupe à ce nom"
                          : filter === "live"
                            ? "Aucun groupe en direct"
                            : catalog.offline
                              ? "Une connexion pour commencer"
                              : "Les groupes arrivent ici"}
                      </Label>
                      <Label muted style={{ fontSize: 15, lineHeight: 22 }}>
                        {search
                          ? "Essaie un autre nom ou retrouve tous les groupes."
                          : filter === "live"
                            ? "Les autres groupes restent consultables dans l’annuaire."
                            : "Charge la liste une première fois pour la retrouver ensuite hors ligne."}
                      </Label>
                      <Button
                        title={
                          search || filter === "live"
                            ? "Voir tous les groupes"
                            : "Actualiser"
                        }
                        variant="secondary"
                        disabled={
                          !search && filter !== "live" && catalog.offline
                        }
                        onPress={() => {
                          setSearch("")
                          setFilter("all")
                          if (!search && filter === "all") catalog.refresh()
                        }}
                      />
                    </>
                  )}
                </View>
              }
            />
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
  searchContainer: { paddingHorizontal: 20, paddingBottom: 14 },
  searchAction: {
    width: 44,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  namedAction: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionLabel: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  listHeader: { gap: 16, paddingTop: 6, paddingBottom: 4 },
  detailHeader: { gap: 12, paddingTop: 6, paddingBottom: 16 },
  contributionHint: { fontSize: 12, lineHeight: 18 },
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
  sidebar: { position: "absolute", left: 16, width: 392 },
  locationError: { position: "absolute", gap: 6 },
})
