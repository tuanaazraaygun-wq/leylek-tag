# Leylek Yolculuk — release R8 rules (targeted keeps; no broad -keep class **)

# React Native / Hermes / TurboModules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Reanimated
-keep class com.swmansion.reanimated.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keep @expo.modules.core.interfaces.DoNotStrip class *
-keepclassmembers class * {
  @expo.modules.core.interfaces.DoNotStrip *;
}

# Firebase / Google Play services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# React Native Firebase
-keep class io.invertase.firebase.** { *; }

# Google Maps / Places
-keep class com.google.android.libraries.maps.** { *; }
-keep class com.google.maps.android.** { *; }
-keep class com.airbnb.android.react.maps.** { *; }
-dontwarn com.google.android.libraries.maps.**

# Agora RTC
-keep class io.agora.** { *; }
-dontwarn io.agora.**

# OkHttp / networking (Supabase / Socket.IO transit)
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# SVG / QR
-keep class com.horcrux.svg.** { *; }

# Gson / reflection used by libraries
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Crashlytics mapping
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}
