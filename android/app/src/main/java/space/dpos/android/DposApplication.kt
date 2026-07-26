package space.dpos.android

import android.app.Application
import space.dpos.android.notifications.NotificationHelper

class DposApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
    }
}
