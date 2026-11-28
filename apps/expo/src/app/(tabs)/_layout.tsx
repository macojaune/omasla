import { Tabs } from "expo-router/js-tabs"

import TabBar from "~/components/tab-bar"
import { usePalette } from "~/theme/ui"

export default function TabsLayout() {
  const c = usePalette()
  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Carte" }} />
      <Tabs.Screen name="ce-soir" options={{ title: "Ce soir" }} />
      <Tabs.Screen name="groupes" options={{ title: "Groupes" }} />
      <Tabs.Screen name="moi" options={{ title: "Moi" }} />
    </Tabs>
  )
}
