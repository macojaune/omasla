import { useState } from "react"
import { Linking, Platform, useWindowDimensions, View } from "react-native"

import type { PublicCatalog, PublicGroup } from "@omasla/convex"
import { positionFreshness } from "@omasla/convex"

import { AnimatedBadge } from "~/beui/components/animated-badge"
import { Card } from "~/beui/components/card"
import {
  ageLabel,
  navigationUrl,
  positionLabel,
  visiblePosition,
} from "~/lib/catalog-model"
import { Button, Icon, Label, Notice, usePalette } from "~/theme/ui"

export default function GroupDetailPanel({
  group,
  catalog,
  now,
  offline,
}: {
  group: PublicGroup
  catalog: PublicCatalog
  now: number
  offline: boolean
}) {
  const c = usePalette()
  const { fontScale } = useWindowDimensions()
  const [error, setError] = useState<string | null>(null)
  const point = visiblePosition(group, catalog, now)
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
      ? "Référent GPS"
      : group.position?.source === "community"
        ? "Observation du public"
        : "Dernier point connu"
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
        {group.position && (
          <Label muted style={{ fontSize: 14, lineHeight: 21 }}>
            {source} · {ageLabel(group.position, now)}
          </Label>
        )}
        {!group.position && (
          <Label muted style={{ fontSize: 15, lineHeight: 22 }}>
            Aucune position partagée pour le moment. Le groupe reste dans
            l’annuaire.
          </Label>
        )}
      </Card>
      {point ? (
        <View style={{ gap: 10 }}>
          <Button
            title="Rejoindre ce point"
            variant={group.live ? "primary" : "secondary"}
            onPress={() => void navigate()}
          />
          <Label
            muted
            style={{ fontSize: 12, lineHeight: 18, textAlign: "center" }}
          >
            Vers la dernière position connue. Le groupe peut continuer à
            avancer.{offline ? " La navigation peut nécessiter du réseau." : ""}
          </Label>
        </View>
      ) : group.position ? (
        <Notice tone="warning">
          Ce point est trop ancien pour proposer un itinéraire. Une nouvelle
          position est attendue.
        </Notice>
      ) : null}
      {error && <Notice tone="error">{error}</Notice>}
      {group.live && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="info" color={c.muted} size={18} />
          <Label muted style={{ fontSize: 13, lineHeight: 20, flex: 1 }}>
            Le suivi du référent est actif. Les déclarations reprendront à la
            fin du live.
          </Label>
        </View>
      )}
    </View>
  )
}
