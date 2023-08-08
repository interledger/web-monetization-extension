type Manifest = chrome.runtime.ManifestV3

class ManifestParser {
  static convertManifestToString(manifest: Manifest): string {
    return JSON.stringify(manifest, null, 2)
  }
}

export default ManifestParser
