import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  Camera,
  Map,
  Marker,
  ViewAnnotation,
} from "@maplibre/maplibre-react-native"

import type { PublicCatalog, PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import type { Bounds } from "~/lib/map-view"
import GroupBanner, { GROUP_BANNER_OFFSET } from "~/components/group-banner"
import { createCarnivalMapStyle } from "~/lib/carnival-map-style"
import { ageLabel, positionLabel, visiblePosition } from "~/lib/catalog-model"
import { overviewPoints } from "~/lib/map-view"
import { Button, Label, usePalette } from "~/theme/ui"

interface Coordinate {
  latitude: number
  longitude: number
}
export interface MapCameraRequest {
  kind: "overview" | "user" | "selection"
  id: number
  coordinate?: Coordinate
}
export interface GroupMapProps {
  catalog: PublicCatalog
  now: number
  selectedId?: string
  selectionReady?: boolean
  cameraReady?: boolean
  onSelect: (group: PublicGroup) => void
  bottomInset?: number
  leftInset?: number
  cameraRequest?: MapCameraRequest
  onPan?: () => void
  onMapPress?: () => void
  userLocation?: Coordinate | null
  /** Visible frame after each settled move, and once the map has loaded. */
  onBoundsChange?: (bounds: Bounds) => void
  /** Buildings in relief (3D). Controlled by the screen's map controls. */
  relief?: boolean
  /** A pitch gesture switches between flat and relief. */
  onReliefChange?: (relief: boolean) => void
}

const initialCenter: [number, number] = [-61.5337, 16.2375]
// Wide enough to see the centre of Pointe-à-Pitre at once.
const OVERVIEW_ZOOM = 15
// Below this zoom, flags drop their name plaque to avoid a pile-up.
const COMPACT_ZOOM = 14.4
const light = {
  position: [1.5, 220, 35] as [number, number, number],
  color: "#fff9e9",
  intensity: 0.38,
}
function validCoordinate(
  value: Coordinate | null | undefined,
): value is Coordinate {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Math.abs(value.latitude) <= 90 &&
      Number.isFinite(value.longitude) &&
      Math.abs(value.longitude) <= 180,
  )
}
export default function GroupMap({
  catalog,
  now,
  selectedId,
  selectionReady = true,
  cameraReady = true,
  onSelect,
  bottomInset = 0,
  leftInset = 0,
  cameraRequest,
  onPan,
  onMapPress,
  userLocation,
  onBoundsChange,
  relief: reliefProp,
  onReliefChange,
}: GroupMapProps) {
  const c = usePalette()
  const { fontScale } = useWindowDimensions()
  const dark = useColorScheme() === "dark"
  const safe = useSafeAreaInsets()
  const camera = useRef<CameraRef>(null)
  const map = useRef<MapRef>(null)
  const [ready, setReady] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [slow, setSlow] = useState(false)
  const [revision, setRevision] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(true)
  const [ownRelief, setOwnRelief] = useState(true)
  const relief = reliefProp ?? ownRelief
  const gestureRelief = useRef<boolean | null>(null)
  const appliedRelief = useRef(relief)
  const [zoom, setZoom] = useState(OVERVIEW_ZOOM)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const handled = useRef<{
    selection?: string
    request?: string
    revision: number
  }>({ revision: -1 })
  const style = useMemo(
    () => createCarnivalMapStyle(dark, relief),
    [dark, relief],
  )
  const visible = useMemo(
    () =>
      catalog.groups.flatMap((group) => {
        const position = visiblePosition(group, catalog, now)
        return position ? [{ group, position }] : []
      }),
    [catalog, now],
  )
  const padding = useMemo(
    () => ({
      // Search field and filter chips, plus room for a plaque above its point.
      top: safe.top + 210,
      right: safe.right + 104,
      bottom: Math.max(
        safe.bottom + 44,
        Math.min(bottomInset + 52, Math.max(44, size.height - safe.top - 284)),
      ),
      left: Math.max(
        safe.left + 28,
        Math.min(leftInset + 28, Math.max(28, size.width - 200)),
      ),
    }),
    [
      safe.top,
      safe.right,
      safe.bottom,
      safe.left,
      bottomInset,
      leftInset,
      size.height,
      size.width,
    ],
  )
  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])
  useEffect(() => {
    if (rendered) return
    const timer = setTimeout(() => setSlow(true), 12_000)
    return () => clearTimeout(timer)
  }, [rendered, revision])
  useEffect(() => {
    if (!ready || !size.width || !size.height || !camera.current) return
    if (handled.current.revision !== revision) handled.current = { revision }
    const requestKey = cameraRequest
      ? `${cameraRequest.kind}:${cameraRequest.id}:${size.width}:${size.height}:${fontScale}`
      : undefined
    const explicitRequest =
      requestKey !== undefined && requestKey !== handled.current.request
    if (explicitRequest && !cameraReady) return
    const newSelection =
      selectedId !== undefined && selectedId !== handled.current.selection
    if (!explicitRequest && !newSelection) {
      if (!selectedId) handled.current.selection = undefined
      return
    }
    const kind = explicitRequest ? cameraRequest?.kind : "selection"
    if (kind === "selection" && !selectionReady) return
    const options = {
      padding,
      pitch: relief ? 42 : 0,
      bearing: -12,
      duration: reduceMotion ? 0 : 600,
    }
    const framed = overviewPoints(visible.map(({ position }) => position))
    if (kind === "overview" && framed.length > 1) {
      const lons = framed.map((position) => position.longitude)
      const lats = framed.map((position) => position.latitude)
      camera.current.fitBounds(
        [
          Math.min(...lons) - 0.00035,
          Math.min(...lats) - 0.00035,
          Math.max(...lons) + 0.00035,
          Math.max(...lats) + 0.00035,
        ],
        {
          ...options,
          // Distant groups use compact flags; leave enough space for a flag
          // without zooming out to reserve the width of a full name plaque.
          padding,
        },
      )
    } else {
      const candidate =
        kind === "user"
          ? (cameraRequest?.coordinate ?? userLocation)
          : kind === "overview"
            ? (framed[0] ?? {
                longitude: initialCenter[0],
                latitude: initialCenter[1],
              })
            : cameraRequest?.kind === "selection" &&
                explicitRequest &&
                cameraRequest.coordinate
              ? cameraRequest.coordinate
              : visible.find(({ group }) => group.id === selectedId)?.position
      if (!validCoordinate(candidate)) return
      camera.current.easeTo({
        center: [candidate.longitude, candidate.latitude],
        zoom: kind === "overview" ? OVERVIEW_ZOOM + 0.6 : 17.2,
        ...options,
      })
    }
    if (explicitRequest) handled.current.request = requestKey
    handled.current.selection = selectedId
    // New GPS points update banners without taking the camera away from a gesture.
  }, [
    ready,
    size.width,
    size.height,
    revision,
    cameraRequest,
    cameraReady,
    selectedId,
    selectionReady,
    userLocation,
    visible,
    padding,
    reduceMotion,
    fontScale,
    relief,
  ])
  useEffect(() => {
    if (appliedRelief.current === relief) return
    appliedRelief.current = relief
    // A pitch gesture already put the camera where the user wanted it.
    if (gestureRelief.current === relief) {
      gestureRelief.current = null
      return
    }
    gestureRelief.current = null
    void camera.current
      ?.setStop({
        pitch: relief ? 42 : 0,
        duration: reduceMotion ? 0 : 450,
        padding,
      })
      .catch(() => undefined)
  }, [relief, reduceMotion, padding])
  function reportBounds() {
    if (!onBoundsChange) return
    void map.current
      ?.getBounds()
      .then(onBoundsChange)
      .catch(() => undefined)
  }
  return (
    <View
      style={[s.wrap, { backgroundColor: c.background }]}
      onLayout={({ nativeEvent }) => setSize(nativeEvent.layout)}
    >
      <Map
        key={revision}
        ref={map}
        style={StyleSheet.absoluteFill}
        mapStyle={style}
        light={light}
        logo={false}
        attribution={false}
        compass={false}
        touchPitch
        onDidFinishLoadingStyle={() => setReady(true)}
        onWillStartLoadingMap={() => {
          setRendered(false)
          setSlow(false)
        }}
        onDidFinishRenderingMapFully={() => {
          setRendered(true)
          setSlow(false)
          reportBounds()
        }}
        onDidFailLoadingMap={() => {
          setReady(false)
          setRendered(false)
          setSlow(true)
        }}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) onPan?.()
        }}
        onRegionDidChange={(event) => {
          const view = event.nativeEvent
          setZoom(view.zoom)
          onBoundsChange?.(view.bounds)
          if (view.userInteraction && view.pitch > 10 !== relief) {
            gestureRelief.current = view.pitch > 10
            setOwnRelief(view.pitch > 10)
            onReliefChange?.(view.pitch > 10)
          }
        }}
        onPress={onMapPress}
        accessibilityLabel="Carte des groupes, bâtiments en relief à Pointe-à-Pitre"
      >
        <Camera
          ref={camera}
          initialViewState={{
            center: initialCenter,
            zoom: OVERVIEW_ZOOM,
            pitch: 42,
            bearing: -12,
          }}
          minZoom={4}
          maxZoom={20}
        />
        {visible.map(({ group, position }) => {
          const freshness = positionFreshness(position, catalog.policy, now)
          const state =
            freshness === "aging"
              ? "aging"
              : group.live && position.source === "referent"
                ? "live"
                : position.source === "community"
                  ? "community"
                  : "legacy"
          const selected = selectedId === group.id
          const description = `${group.title}. ${positionLabel(group, catalog, now)}, ${ageLabel(position, now)}. Voir le groupe`
          const banner = (
            <GroupBanner
              group={group}
              selected={selected}
              compact={zoom < COMPACT_ZOOM}
              state={state}
              label={positionLabel(group, catalog, now)}
              age={ageLabel(position, now)}
              // iOS routes taps through the native annotation, once.
              onPress={
                Platform.OS === "ios" ? undefined : () => onSelect(group)
              }
            />
          )
          const markerProps = {
            id: group.id,
            lngLat: [position.longitude, position.latitude] as [number, number],
            anchor: "bottom-left" as const,
            offset: GROUP_BANNER_OFFSET,
            selected,
          }
          return Platform.OS === "ios" ? (
            <ViewAnnotation
              key={`${group.id}:${fontScale}`}
              {...markerProps}
              title={description}
              onPress={(event) => {
                event.stopPropagation()
                onSelect(group)
              }}
            >
              {banner}
            </ViewAnnotation>
          ) : (
            <Marker
              key={`${group.id}:${fontScale}`}
              {...markerProps}
              accessibilityLabel={description}
            >
              {banner}
            </Marker>
          )
        })}
        {validCoordinate(userLocation) && (
          <Marker
            id="user-position"
            lngLat={[userLocation.longitude, userLocation.latitude]}
            accessibilityLabel="Ta position"
          >
            <View
              style={[
                s.userPosition,
                { backgroundColor: c.primary, borderColor: c.surface },
              ]}
            />
          </Marker>
        )}
      </Map>
      {!rendered && slow && (
        <View
          style={[
            s.loadError,
            {
              left: Math.max(20, leftInset + 20),
              right: 20,
              bottom: Math.max(safe.bottom + 28, bottomInset + 20),
              backgroundColor: c.surface,
            },
          ]}
        >
          <Label style={s.messageTitle}>
            La carte prend du temps à charger
          </Label>
          <Label muted style={s.messageText}>
            Tu peux retrouver les groupes dans l’onglet Groupes.
          </Label>
          <Button
            title="Réessayer la carte"
            variant="secondary"
            onPress={() => {
              setReady(false)
              setRendered(false)
              setSlow(false)
              setRevision((value) => value + 1)
            }}
          />
        </View>
      )}
    </View>
  )
}
const s = StyleSheet.create({
  wrap: { flex: 1 },
  userPosition: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  loadError: { position: "absolute", gap: 10, padding: 18, borderRadius: 16 },
  messageTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  messageText: { fontSize: 13, lineHeight: 18 },
})
