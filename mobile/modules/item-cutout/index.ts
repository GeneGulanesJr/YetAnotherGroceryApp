import { requireOptionalNativeModule } from "expo";

/** One segmented subject: its box in source-image pixels and a transparent PNG. */
export interface CutoutSubject {
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Opaque pixels in the source image, the subject's real size. */
  pixels: number;
  fileWidth: number;
  fileHeight: number;
}

const native = requireOptionalNativeModule<{ segment(uri: string): Promise<CutoutSubject[]> }>("ItemCutout");

/** Android builds only: iOS and Expo Go have no native module and get no subjects. */
export async function segmentSubjects(uri: string): Promise<CutoutSubject[]> {
  return native === null ? [] : native.segment(uri);
}
