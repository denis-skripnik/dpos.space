plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "space.dpos.android"
    compileSdk = 35
    testOptions.unitTests.isIncludeAndroidResources = true

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "space.dpos.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 80
        versionName = "3.1.2"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "DPOS_WEB_URL", "\"https://dpos.blinddev.xyz/\"")
        // Operator-supplied base64 raw Ed25519 public key; absent means updater disabled.
        val releasePin = providers.gradleProperty("dposReleasePublicKey").orNull ?: ""
        require(releasePin.isEmpty() || Regex("[A-Za-z0-9+/]{43}=").matches(releasePin))
        buildConfigField("String", "DPOS_RELEASE_PUBLIC_KEY", "\"$releasePin\"")
        // Independently pinned from installed 3.1.1; never accept a candidate-repo file/property override.
        val historicCert = "86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27"
        buildConfigField("String", "DPOS_HISTORIC_CERT", "\"$historicCert\"")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
            // This stable build intentionally upgrades the installed 0.1.76 debug app.
            // Keep the package and certificate compatible until a separately planned
            // migration to a production application ID and signing key is available.
            applicationIdSuffix = ".debug"
            signingConfig = signingConfigs.getByName("debug")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.credentials:credentials:1.6.0-beta02")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0-beta02")
    implementation("org.bitcoinj:bitcoinj-core:0.16.3")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("org.robolectric:robolectric:4.13")
}
