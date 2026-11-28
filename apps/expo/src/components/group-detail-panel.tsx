import { useState } from "react"
import { Linking, Platform, useWindowDimensions, View } from "react-native"
import { useRouter } from "expo-router"

import type { PublicCatalog, PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import type { Coordinate } from "~/lib/map-view"
import { AnimatedBadge } from "~/beui/components/animated-badge"
import { Card } from "~/beui/components/card"
import {
  ageLabel,
  navigationUrl,
  positionLabel,
  visiblePosition,
} from "~/lib/catalog-model"
import { distanceLabel, distanceMeters, groupAction } from "~/lib/map-view"
import { Button, Icon, Label, Notice, usePalette } from "~/theme/ui"

const capitalize = (value: string) =>
  value.charAt(0).toLocaleUpperCase("fr") + value.slice(1)

export default function GroupDetailPanel({
  group,
  catalog,
  now,
  offline,
  canWrite,
  userLocation,
}: {
  group: PublicGroup
  catalog: PublicCatalog
  now: number
  offline: boolean
  canWrite: boolean
  /** Only once the spectator asked to be located: no distance otherwise. */
  userLocation: Coordinate | null
}) {
  const c = usePalette()
  const router = useRouter()
  const { fontScale } = useWindowDimensions()
  const [error, setError] = useState<string | null>(null)
  const point = visiblePosition(group, catalog, now)
  const action = groupAction(group, catalog, now)
  const freshness = positionFreshness(group.position, catalog.policy, now)
  const live =
    freshness === "recent" &&
    group.live &&
    group.position?.source === "referent"
  const status =
    freshness === "recent"
      ? "success"
      : freshness === "aging"
        ? "warning"
        : "neutral"
  const label = positionLabel(group, catalog, now)
  const source =
    group.position?.source === "referent"
      ? "Membre du groupe (GPS)"
      : group.position?.source === "community"
        ? "Signalé par le public"
        : "Dernier point connu"
  const distance =
    point && userLocation
      ? distanceLabel(distanceMeters(userLocation, point))
      : null
  async function navigate() {
    if (!point) return
    setError(null)
    try {
      const url = navigationUrl(point, Platform.OS)
      if (!(await Linking.canOpenURL(url))) throw new Error()
      await Linking.openURL(url)
    } catch {
      setError(
        "Impossible d’ouvrir l’application de navigation. Réessaie depuis cette fiche.",
      )
    }
  }
  const observe = () =>
    router.push({ pathname: "/observe", params: { groupId: group.id } })
  const observeButton = (variant: "primary" | "secondary") => (
    <View style={{ gap: 8 }}>
      <Button
        title="Je le vois ici"
        icon="pin"
        variant={variant}
        disabled={!canWrite}
        onPress={observe}
      />
      <Label muted style={hint}>
        {canWrite
          ? "Partage sa position si tu le vois devant toi, maintenant."
          : "Reconnecte-toi pour partager une position."}
      </Label>
    </View>
  )
  return (
    <View style={{ gap: 20, paddingTop: 2 }}>
      <Card variant="muted" size="compact" style={{ gap: 8 }}>
        {fontScale <= 1.2 ? (
          <AnimatedBadge status={status} pulse={live}>
            {label}
          </AnimatedBadge>
        ) : (
          <Label style={{ fontWeight: "600" }}>{label}</Label>
        )}
        {group.position ? (
          <Label muted style={{ fontSize: 14, lineHeight: 21 }}>
            {label === "Signalée par le public"
              ? capitalize(ageLabel(group.position, now))
              : `${source} · ${ageLabel(group.position, now)}`}
          </Label>
        ) : (
          <Label muted style={{ fontSize: 15, lineHeight: 22 }}>
            {group.live
              ? "Le membre du groupe vient de lancer le direct. Son premier point arrive."
              : "Aucune position partagée pour le moment. Le groupe reste dans l’annuaire."}
          </Label>
        )}
      </Card>
      {action.primary === "go" && (
        <View style={{ gap: 10 }}>
          <Button
            title={distance ? `Y aller · ${distance}` : "Y aller"}
            icon="walk"
            onPress={() => void navigate()}
          />
          <Label muted style={hint}>
            Itinéraire à pied vers le dernier point connu. Le groupe peut
            continuer à avancer.
            {offline ? " La navigation peut nécessiter du réseau." : ""}
          </Label>
        </View>
      )}
      {freshness === "hidden" && !group.live && (
        <Notice tone="warning">
          Ce point est trop ancien pour proposer un itinéraire.
        </Notice>
      )}
      {action.primary === "observe" && observeButton("primary")}
      {action.primary === "go" &&
        action.addition === "open" &&
        observeButton("secondary")}
      {action.addition === "closed" && action.primary !== "go" && (
        <Notice>
          L’ajout par le public n’est pas ouvert pour ce groupe en ce moment.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {action.addition === "live" && (
        <View
          accessible
          accessibilityLabel="Ajout indisponible pendant le direct. Un membre du groupe partage déjà sa position. L’ajout par le public reprendra à la fin du direct."
          style={{ flexDirection: "row", gap: 10 }}
        >
          <Icon name="signal" color={c.success} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Label style={{ fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
              Ajout indisponible pendant le direct
            </Label>
            <Label muted style={{ fontSize: 13, lineHeight: 20 }}>
              Un membre du groupe partage déjà sa position. L’ajout par le
              public reprendra à la fin du direct.
            </Label>
          </View>
        </View>
      )}
    </View>
  )
}
const hint = { fontSize: 12, lineHeight: 18, textAlign: "center" as const }
