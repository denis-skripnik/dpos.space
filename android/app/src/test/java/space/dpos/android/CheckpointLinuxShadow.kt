package space.dpos.android

import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowLinux
import java.io.File
import java.io.FileDescriptor
import java.io.FileInputStream
import java.util.Collections
import java.util.IdentityHashMap

/** Robolectric's Linux.open uses RandomAccessFile, which cannot open directories.
 * Only directory open/fsync/close is a unit-test stand-in; actual Android durability
 * is a separate instrumentation gate, never established by these JVM tests.
 */
@Implements(className = "libcore.io.Linux", isInAndroidSdk = false)
class CheckpointLinuxShadow : ShadowLinux() {
    @Implementation override fun open(path: String, flags: Int, mode: Int): FileDescriptor {
        if (File(path).isDirectory) return FileDescriptor().also { directories.add(it) }
        return super.open(path, flags, mode)
    }
    @Implementation fun fsync(fd: FileDescriptor) { if (!directories.contains(fd)) fd.sync() }
    @Implementation fun close(fd: FileDescriptor) {
        if (!directories.remove(fd)) FileInputStream(fd).close()
    }
    companion object {
        private val directories = Collections.synchronizedSet(Collections.newSetFromMap(IdentityHashMap<FileDescriptor, Boolean>()))
    }
}
