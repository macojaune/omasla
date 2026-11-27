# Clerk pour l’identité Omasla

MAR-413 et MAR-414. La première activation se fait en DEV, dans le workspace Clerk `marvinl.com`. Le web et Expo utilisent la même instance Clerk de développement. Google passe par les identifiants de développement partagés de Clerk et le navigateur système d’Expo revient sur `omasla://login`.

Le serveur vérifie la signature, l’émetteur et la session Clerk active avant de signer un JWT Convex valable au maximum 60 secondes. Son sujet `clerk:user_…` est stable sur le web et sur mobile. Il n’y a aucun rapprochement par adresse e-mail. Les habilitations et les sessions de suivi sont stockées dans Convex. Les tables historiques restent en place.

Le web et le mobile révoquent la session de suivi dans Convex avant de déconnecter Clerk. Le mobile bloque aussi les nouveaux jetons de suivi tant qu’une déconnexion hors ligne attend une confirmation serveur. Une révocation déclenchée directement dans Clerk empêche la prochaine émission. Un JWT Convex déjà signé peut alors rester valable jusqu’à 60 secondes.

La consultation publique reste ouverte. La clé publique est injectée au build web par `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` et au build Expo par `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. `CLERK_SECRET_KEY` est réservé au serveur web. Le retour mobile doit être autorisé dans l’instance de développement correspondante. L’émetteur et la JWKS que Convex utilise restent ceux d’Omasla.
