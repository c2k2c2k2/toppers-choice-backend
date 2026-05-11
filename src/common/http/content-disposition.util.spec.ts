import { buildContentDispositionHeader } from './content-disposition.util';

describe('buildContentDispositionHeader', () => {
  it('keeps the header ASCII-safe while preserving UTF-8 filename metadata', () => {
    const header = buildContentDispositionHeader(
      'inline',
      'भारत - एक दृष्टीक्षेप.pdf',
    );

    expect(header).toContain('inline; filename="file.pdf";');
    expect(header).toContain("filename*=UTF-8''");
    expect([...header].every((character) => character.charCodeAt(0) <= 0x7f)).toBe(
      true,
    );
  });
});
