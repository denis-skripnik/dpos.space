package space.dpos.android.upvoter

/** Unavailable observations are retryable; genuine policy rejections are not read failures. */
object GolosContentStatus {
    fun unavailable(reason: String) = reason.substringBefore(':') in setOf(
        "root_post_unknown", "root_post_transport", "root_post_empty", "root_post_malformed", "own_vote_unavailable")
}
