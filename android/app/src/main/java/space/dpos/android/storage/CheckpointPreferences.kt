package space.dpos.android.storage

import android.content.SharedPreferences

/** Routes only retired transaction keys to the new authority; ordinary prefs stay ordinary.
 * Editors never copy poisoned legacy transaction values into the journal. Bootstrap must
 * have verified before any ordinary write can flush the Android cached preference map.
 */
internal class CheckpointPreferences(
    private val ordinary: SharedPreferences,
    private val checkpoint: TransactionCheckpointStore
) : SharedPreferences by ordinary {
    private fun value(key: String, fallback: () -> Any?): Any? =
        if (TransactionCheckpointStore.isTransactionKey(key)) checkpoint.read(key) else fallback()
    override fun getAll(): MutableMap<String, *> = ordinary.all.filterKeys { !TransactionCheckpointStore.isTransactionKey(it) }
        .toMutableMap().apply { putAll(checkpoint.snapshot()) }
    override fun contains(key: String): Boolean = if (TransactionCheckpointStore.isTransactionKey(key)) checkpoint.read(key) != null else ordinary.contains(key)
    override fun getString(key: String, defValue: String?): String? = value(key) { ordinary.getString(key, defValue) }?.let { it as String } ?: defValue
    override fun getBoolean(key: String, defValue: Boolean): Boolean = value(key) { ordinary.getBoolean(key, defValue) }?.let { it as Boolean } ?: defValue
    override fun getInt(key: String, defValue: Int): Int = value(key) { ordinary.getInt(key, defValue) }?.let { it as Int } ?: defValue
    override fun getLong(key: String, defValue: Long): Long = value(key) { ordinary.getLong(key, defValue) }?.let { it as Long } ?: defValue
    override fun getFloat(key: String, defValue: Float): Float = value(key) { ordinary.getFloat(key, defValue) }?.let { it as Float } ?: defValue
    override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? =
        if (TransactionCheckpointStore.isTransactionKey(key)) error("transaction string sets are immutable import evidence") else ordinary.getStringSet(key, defValues)
    override fun edit(): SharedPreferences.Editor = Editor()
    private inner class Editor : SharedPreferences.Editor {
        val changes = linkedMapOf<String, Any?>()
        private fun put(key: String, value: Any?): SharedPreferences.Editor { changes[key] = value; return this }
        override fun putString(key: String, value: String?) = put(key, value)
        override fun putStringSet(key: String, values: MutableSet<String>?) = put(key, values?.toSet())
        override fun putInt(key: String, value: Int) = put(key, value)
        override fun putLong(key: String, value: Long) = put(key, value)
        override fun putFloat(key: String, value: Float) = put(key, value)
        override fun putBoolean(key: String, value: Boolean) = put(key, value)
        override fun remove(key: String) = put(key, null)
        override fun clear(): SharedPreferences.Editor = error("cannot clear retired transaction authority")
        override fun commit(): Boolean = synchronized(checkpoint.lock) {
            checkpoint.assertPreferencesWritable()
            val tx = changes.filterKeys { TransactionCheckpointStore.isTransactionKey(it) }
            val normal = changes.filterKeys { !TransactionCheckpointStore.isTransactionKey(it) }
            check(tx.isEmpty() || normal.isEmpty()) { "mixed journal/preferences atomicity unsupported" }
            if (tx.isNotEmpty()) { checkpoint.put(tx); true } else {
                val edit = ordinary.edit()
                normal.forEach { (key, value) -> when (value) {
                    null -> edit.remove(key)
                    is String -> edit.putString(key, value)
                    is Boolean -> edit.putBoolean(key, value)
                    is Int -> edit.putInt(key, value)
                    is Long -> edit.putLong(key, value)
                    is Float -> edit.putFloat(key, value)
                    is Set<*> -> { @Suppress("UNCHECKED_CAST") edit.putStringSet(key, value as Set<String>) }
                    else -> error("unsupported preference type")
                } }
                edit.commit()
            }
        }
        // Synchronous ordinary commit avoids deferred startup writers bypassing bootstrap.
        override fun apply() { check(commit()) { "worker preference commit failed" } }
    }
}
