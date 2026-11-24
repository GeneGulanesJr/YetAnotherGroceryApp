package expo.modules.itemcutout

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.Subject
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.roundToInt

private const val MAX_SIDE = 480
private const val MIN_ALPHA = 32
private const val MAX_SUBJECTS = 4
private const val TIMEOUT_SECONDS = 30L

class ItemCutoutModule : Module() {
  // One run at a time: each holds a full bitmap, and budget phones have little heap.
  private val worker = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("ItemCutout")

    AsyncFunction("segment") { uri: String, promise: Promise ->
      worker.execute {
        try {
          promise.resolve(segment(uri))
        } catch (cause: Throwable) { // Includes OutOfMemoryError: a cutout is never worth a crash.
          promise.reject("ERR_ITEM_CUTOUT", cause.message ?: "Segmentation failed", cause)
        }
      }
    }

    OnDestroy { worker.shutdown() }
  }

  private fun segment(uri: String): List<Map<String, Any>> {
    val cacheDir = appContext.reactContext?.cacheDir ?: return emptyList()
    val path = Uri.parse(uri).path ?: return emptyList()
    val source = BitmapFactory.decodeFile(path) ?: return emptyList()
    val options = SubjectSegmenterOptions.Builder()
      .enableMultipleSubjects(
        SubjectSegmenterOptions.SubjectResultOptions.Builder().enableSubjectBitmap().build(),
      )
      .build()
    val segmenter = SubjectSegmentation.getClient(options)
    try {
      val result = Tasks.await(
        segmenter.process(InputImage.fromBitmap(source, 0)),
        TIMEOUT_SECONDS,
        TimeUnit.SECONDS,
      )
      val dir = File(cacheDir, "item-cutouts").apply { mkdirs() }
      return result.subjects
        .sortedByDescending { it.width * it.height }
        .take(MAX_SUBJECTS)
        .mapNotNull { save(it, dir) }
    } finally {
      segmenter.close()
      source.recycle()
    }
  }

  /** Trims transparent padding, caps the longest side and writes a PNG. */
  private fun save(subject: Subject, dir: File): Map<String, Any>? {
    val bitmap = subject.bitmap ?: return null
    val w = bitmap.width
    val h = bitmap.height
    val pixels = IntArray(w * h)
    bitmap.getPixels(pixels, 0, w, 0, 0, w, h)

    var left = w
    var top = h
    var right = -1
    var bottom = -1
    var opaque = 0
    for (y in 0 until h) {
      for (x in 0 until w) {
        if (pixels[y * w + x] ushr 24 >= MIN_ALPHA) {
          opaque += 1
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (opaque == 0) return null

    val boxWidth = right - left + 1
    val boxHeight = bottom - top + 1
    val scale = minOf(1f, MAX_SIDE.toFloat() / max(boxWidth, boxHeight))
    val fileWidth = max(1, (boxWidth * scale).roundToInt())
    val fileHeight = max(1, (boxHeight * scale).roundToInt())
    val trimmed = Bitmap.createBitmap(bitmap, left, top, boxWidth, boxHeight)
    val output = Bitmap.createScaledBitmap(trimmed, fileWidth, fileHeight, true)

    val file = File(dir, "${UUID.randomUUID()}.png")
    FileOutputStream(file).use { output.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return mapOf(
      "uri" to Uri.fromFile(file).toString(),
      "x" to subject.startX + left,
      "y" to subject.startY + top,
      "width" to boxWidth,
      "height" to boxHeight,
      "pixels" to opaque,
      "fileWidth" to fileWidth,
      "fileHeight" to fileHeight,
    )
  }
}
