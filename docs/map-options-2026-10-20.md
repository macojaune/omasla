# Omasla — choix cartographiques

Audit du code et recherche documentaire officielle du 20 octobre 2026. Cette étude ne constitue pas un benchmark de performances entre fournisseurs, ni une validation de couverture sur toute la Guadeloupe.

## Ce qui est utilisé aujourd’hui

| Partie          | Choix actuel                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Moteur mobile   | `@maplibre/maplibre-react-native` 11.5.0, dans Expo / React Native                                        |
| Fond et données | Tuiles vectorielles Plan IGN, bâtiments `bati_surf` et hauteurs disponibles                               |
| Style           | Couleurs et couches propres à Omasla, jour/nuit, carte inclinée ou à plat                                 |
| Groupes         | Bannières et emblèmes React Native ; positions et autorité du live gérées par Convex                      |
| Bâtiments       | Extrusion des empreintes avec hauteur positive ; pas de façades/toits photoréalistes ni modèle de terrain |
| Rejoindre       | Plans sur iOS / Google Maps sur Android, itinéraire piéton externe vers le dernier point connu            |
| Site Next.js    | Mapbox GL JS, distinct de la carte mobile                                                                 |
| Aperçu Expo web | Liste/fiches et message de renvoi vers la carte native                                                    |
| Hors ligne      | Catalogue public déjà chargé ; pas de téléchargement de zones cartographiques                             |

Un moteur dessine la carte ; un fournisseur livre rues, bâtiments, images et styles ; un service d’itinéraire calcule le trajet. Les trois ne se remplacent pas nécessairement ensemble. OpenStreetMap est notamment une source de données, pas une app ni un SDK mobile complet.

La refonte avait étudié les références UX Plans/Google Maps/Waze, la composition du panneau, les bannières et la présence de hauteurs de bâtiments à Pointe-à-Pitre. Aucun comparatif complet Mapbox/MapTiler/HERE n’a été retrouvé. Le choix actuel était pragmatique et testé localement ; cette note formalise la comparaison qui manquait.

## Les rendus possibles

| Rendu                              | Usage pertinent                                           | Conséquence pour Omasla                                                                                           |
| ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Plan vectoriel 2D                  | Lecture des rues, contraste, faible encombrement visuel   | Base recommandée et entièrement personnalisable avec MapLibre                                                     |
| Plan incliné avec bâtiments        | Repères urbains, personnalité et impression de profondeur | Déjà présent avec les hauteurs IGN disponibles ; garder une bascule à plat                                        |
| Satellite / orthophoto / hybride   | Reconnaître un lieu réel, son bâti ou son environnement   | Autre source de données, à évaluer ; peut rendre les groupes moins lisibles et charger plus de données            |
| Relief du terrain                  | Collines, pentes et vues étendues                         | Nécessite un modèle d’altitude distinct des hauteurs de bâtiments ; non présent actuellement                      |
| Scène 3D détaillée                 | Monuments, façades, éclairage avancé, ambiance urbaine    | Dépend fortement de la couverture et du SDK ; une démonstration à Paris ne prouve pas la qualité à Pointe-à-Pitre |
| Plan très épuré / couleurs propres | Mettre les groupes au premier plan                        | Possible avec notre moteur ; la personnalité ne nécessite pas un fournisseur particulier                          |

## Options adaptées à Expo / React Native

| Solution                              | Apport                                                                                                                              | Contraintes et modèle économique                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MapLibre + IGN, actuel**            | Liberté du style, bannières natives, volumes simples, mêmes principes sur iOS/Android ; données locales déjà observées              | Moteur ouvert ; données IGN publiques sous leurs conditions. Maintenance du style, chargement, attribution et limites du service à prendre en charge. Aucun guidage inclus                       |
| **Mapbox + `@rnmapbox/maps`**         | Studio, styles et données intégrés, scène Standard avec éclairage et objets 3D selon couverture, gamme Search/Directions/Navigation | Compte/jeton, facturation des cartes par utilisateurs actifs mensuels selon offre ; services supplémentaires distincts. Rebuild natif Expo nécessaire ; compatibilité Expo 57/RN 0.86 à vérifier |
| **Google Maps + `react-native-maps`** | Fond familier, SDK iOS/Android, Places et Routes disponibles séparément                                                             | Projet/clé et tarification selon services/SKU ; personnalisation du fond encadrée, différente d’un style vectoriel libre                                                                         |
| **Apple MapKit**                      | Cohérence iPhone, annotations et présentations standard/satellite/hybrides                                                          | Apple Maps uniquement côté iOS ; une autre solution pour Android. Le SDK embarqué ne donne pas automatiquement toutes les fonctions de l’app Plans                                               |
| **MapTiler + MapLibre**               | Fonds et styles alternatifs, satellite et outil de conception tout en gardant le moteur                                             | Clé, quotas et abonnement ; avec MapLibre tiers, vérifier le calcul par requêtes au lieu d’appliquer les prix par session du SDK MapTiler                                                        |
| **HERE**                              | Navigation embarquée et hors ligne lorsque cet usage devient central                                                                | Intégrations documentées principalement natives/Flutter, adaptation React Native à étudier ; fonctions Navigate sous licence dédiée                                                              |

Les modèles tarifaires doivent être chiffrés avec une prévision d’utilisateurs actifs, sessions, tuiles et appels de recherche/navigation. Le statut open source du moteur ne signifie pas que tout hébergement de données est gratuit ; inversement une clé fournisseur ne signifie pas que chaque affichage est facturé. Aucun coût mensuel fictif n’est attribué ici.

## Mapbox : possible, mais pour quel bénéfice ?

Oui, l’intégration Expo est documentée par le projet RNMapbox avec un config plugin et du code natif. Elle impose une development build ; Expo Go ne suffit pas. Le wrapper React Native est distinct des SDK natifs Mapbox et l’installation de Maps n’ajoute pas automatiquement le Navigation SDK.

Les bannières, la palette de couleurs, les volumes simples, la caméra inclinée et le principe de packs hors ligne ne sont pas exclusifs à Mapbox. MapLibre expose lui aussi un gestionnaire hors ligne ; il faudrait construire et valider ce parcours dans Omasla et respecter les règles du fournisseur de tuiles.

La plus-value Mapbox est surtout l’ensemble des outils de conception, des styles/données et des services intégrés, ainsi que certaines capacités de scène Standard. Standard offre des réglages et des emplacements d’insertion dédiés : il ne donne pas la même liberté sur toutes ses couches internes qu’un style construit intégralement à la main.

La disponibilité de monuments détaillés, de façades et d’un meilleur réseau piéton sur les secteurs du carnaval reste à vérifier. Changer de fournisseur ne résout pas l’interception d’un groupe qui avance ni l’identification des rues fermées pour le carnaval.

## Recommandation

**Conserver MapLibre + IGN pour la V1.** L’architecture couvre les besoins décidés et le rendu personnalisé existe. La prochaine comparaison utile serait un prototype Mapbox Standard face au rendu actuel, aux mêmes coordonnées de Pointe-à-Pitre et des Abymes, avec les mêmes bannières, zoom, angle et nombre de groupes.

Comparer lisibilité au soleil, qualité des repères locaux, temps de chargement, fluidité, comportement en réseau faible et consommation sur iPhone et Android. Si le besoin porte surtout sur l’apparence du fond, tester MapTiler avec MapLibre est une alternative moins intrusive qu’un changement de moteur. Aucune migration de fournisseur n’est réalisée par cet audit.

## Sources officielles

Consultées le 20 octobre 2026 ; conditions et tarification à revérifier au moment d’un achat.

- MapLibre : [démarrage et fournisseurs de cartes](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), [OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/).
- IGN : [Plan IGN](https://cartes.gouv.fr/aide/fr/partenaires/ign/representations-cartographiques-souveraines/plan-ign/), [données publiques libres et gratuites](https://www.ign.fr/espace-presse/le-site-de-reference-des-donnees-publiques-libres-et-gratuites-de-lign), [conditions des services](https://cartes.gouv.fr/cgu/?lang=fr).
- RNMapbox : [plugin Expo](https://github.com/rnmapbox/maps/blob/main/plugin/install.md).
- Mapbox : [Standard](https://docs.mapbox.com/map-styles/guides/standard-styles/), [cartes hors ligne](https://docs.mapbox.com/ios/maps/guides/offline/), [facturation Maps SDK](https://docs.mapbox.com/ios/maps/guides/pricing/), [tarifs des services](https://www.mapbox.com/pricing).
- Expo : [react-native-maps](https://docs.expo.dev/versions/latest/sdk/map-view/), [Expo Maps](https://docs.expo.dev/versions/latest/sdk/maps/).
- Google : [bâtiments et personnalisation](https://developers.google.com/maps/documentation/ios-sdk/cloud-customization/building-style), [usage et facturation iOS](https://developers.google.com/maps/documentation/ios-sdk/usage-and-billing).
- Apple : [Maps dans les Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/maps).
- MapTiler : [React Native](https://docs.maptiler.com/react-native/), [sessions et requêtes](https://docs.maptiler.com/guides/account/sessions-vs-requests/), [tarifs](https://www.maptiler.com/cloud/pricing/).
- HERE : [éditions](https://docs.here.com/here-sdk/docs/flutter-introduction-editions), [accès](https://docs.here.com/here-sdk/docs/flutter-get-started), [hors ligne](https://docs.here.com/here-sdk/docs/flutter-offline-maps).

Sources du code : `apps/expo/src/components/group-map.tsx`, `apps/expo/src/lib/carnival-map-style.ts`, `apps/expo/src/lib/catalog-model.ts`, `apps/nextjs/src/app/_components/map/map-component.tsx`. Les échantillons IGN documentés dans `.impeccable/explorations/map-personality-20261014/building-data-evidence.md` concernent une zone de Pointe-à-Pitre, pas la couverture de toute la Guadeloupe.
