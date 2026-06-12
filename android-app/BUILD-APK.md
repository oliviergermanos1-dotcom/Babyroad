# Babyroad — Build APK Android

Guide complet pour compiler `babyroad.apk` (tracking GPS écran éteint).
À exécuter sur une machine avec **Node 18+**, **Android Studio** (SDK 33+) et **JDK 17**.

## 1. Préparer le projet

```bash
cd android-app
npm install

# Config : copier le template et coller la clé anon Supabase
cp src/config.example.js src/config.js
# → éditer src/config.js (SUPABASE_ANON_KEY)

# Générer la plateforme Android (une seule fois)
npx cap add android
```

## 2. Permissions AndroidManifest.xml

Ouvrir `android/app/src/main/AndroidManifest.xml` et vérifier que **toutes** ces
permissions sont présentes (le plugin en ajoute une partie, compléter le reste) :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.BATTERY_STATS"/>
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
```

## 3. Builder le web + synchroniser

```bash
npm run build        # bundle src/ → www/
npx cap sync android
```

## 4. Keystore (PREMIÈRE FOIS UNIQUEMENT)

```bash
keytool -genkey -v -keystore babyroad.keystore \
        -alias babyroad -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ **CONSERVER `babyroad.keystore` + son mot de passe en lieu sûr.**
> Toute mise à jour future de l'APK exige le MÊME keystore. S'il est perdu,
> les 4 téléphones devront désinstaller/réinstaller (contrainte #7).
> Ne JAMAIS committer le keystore (déjà dans .gitignore).

Déclarer la signature dans `android/app/build.gradle` :

```gradle
android {
  signingConfigs {
    release {
      storeFile file("../../babyroad.keystore")
      storePassword System.getenv("BABYROAD_KEYSTORE_PASS")
      keyAlias "babyroad"
      keyPassword System.getenv("BABYROAD_KEYSTORE_PASS")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
```

## 5. Build release signé

```bash
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

Renommer en `babyroad.apk` et distribuer par lien direct (hors Play Store).

## 6. Installation sur les 4 téléphones

1. Autoriser "Sources inconnues" pour le navigateur/gestionnaire de fichiers.
2. Installer l'APK, ouvrir Babyroad.
3. À la 1ère activation du tracking, accorder la localisation **"Autoriser tout le temps"**
   (pas "Uniquement si l'app est ouverte").
4. Désactiver l'optimisation de batterie pour Babyroad :
   Réglages → Batterie → Babyroad → "Non optimisée".
   Sur Xiaomi/Tecno/Infinix : aussi activer "Démarrage automatique".
5. Vérifier la notification persistante "Babyroad — Tracking actif" dans la barre :
   c'est la preuve que le Foreground Service tourne (écran éteint inclus).
