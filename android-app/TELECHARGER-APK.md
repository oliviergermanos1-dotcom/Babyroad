# 📲 Télécharger et installer l'APK Babyroad

L'APK est **compilée automatiquement dans le cloud** (GitHub Actions) à chaque
mise à jour du code — aucun ordinateur ni Android Studio nécessaire.

## Où télécharger

**Lien direct (toujours la dernière version) :**
https://github.com/oliviergermanos1-dotcom/Babyroad/releases/tag/apk-latest

→ dans la section **Assets**, toucher **`babyroad.apk`**.

(Alternative : onglet **Actions** du dépôt → dernier run vert « Build Babyroad
APK » → section **Artifacts** → `babyroad-apk`.)

## Installer sur le téléphone du chauffeur

1. Télécharger `babyroad.apk`.
2. À l'ouverture, Android demande d'autoriser « **Installer des applis inconnues** »
   pour le navigateur/gestionnaire de fichiers → **Autoriser**.
3. Installer, puis ouvrir **Babyroad**.
4. Choisir le conducteur, appuyer sur **DÉMARRER LE TRACKING**.
5. Accorder la localisation **« Autoriser tout le temps »** (PAS « seulement
   si l'appli est ouverte ») — c'est ce qui permet le GPS écran éteint.
6. **Désactiver l'optimisation de batterie** pour Babyroad :
   Réglages → Applications → Babyroad → Batterie → **Sans restriction**.
   Sur Tecno / Infinix / Itel : activer aussi **Démarrage automatique**.

## Vérifier que ça marche

- Une notification permanente **« Babyroad — Tracking actif »** apparaît dans
  la barre Android : c'est la preuve que le service tourne (écran éteint inclus).
- Verrouiller le téléphone, le mettre en poche : le camion continue de bouger
  sur le dashboard dispatcher.

## Économie de batterie

Le GPS natif ne se réveille **qu'au déplacement de 15 m**. Camion à l'arrêt =
quasi zéro consommation. En roulage continu, prévoir un **chargeur voiture**
(le GPS + l'écran, s'il reste allumé, restent gourmands sur une journée).
