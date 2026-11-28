import { Redirect } from "expo-router"

/** Older notifications and saved login returns still point here. */
export default function LegacyAccount() {
  return <Redirect href="/moi" />
}
