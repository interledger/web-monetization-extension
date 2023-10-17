import ManifestParser from './index';

describe('ManifestParser', () => {
  it('should convert manifest to a formatted string', () => {
    const manifest = {
      name: 'My Extension',
      version: '1.0',
      manifest_version: 3, 
    };

    const expectedString = JSON.stringify(manifest, null, 2);

    const result = ManifestParser.convertManifestToString(manifest);

    expect(result).toBe(expectedString);
  });

});
