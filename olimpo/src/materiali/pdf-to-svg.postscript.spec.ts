import {
  buildPdfToSvgArgs,
  convertPdfToSvgUsingPostScript,
  InkscapeRunner,
} from './pdf-to-svg.postscript';

describe('pdf-to-svg.postscript (inkscape)', () => {
  it('builds inkscape args for single-page PDF->SVG conversion', () => {
    const args = buildPdfToSvgArgs({
      pdfPath: 'C:\\input\\file.pdf',
      outputPath: 'C:\\output\\file.svg',
      firstPage: 2,
      lastPage: 2,
      isWindows: true,
    });

    expect(args).toEqual([
      '--pdf-poppler',
      '--pages=2',
      '--export-type=svg',
      '--export-filename=C:/output/file.svg',
      'C:/input/file.pdf',
    ]);
  });

  it('runs inkscape and creates output directory when missing', async () => {
    const runInkscape: jest.MockedFunction<InkscapeRunner> = jest.fn().mockResolvedValue(undefined);
    const existsSync = jest.fn((filePath: string) => filePath === '/tmp/in.pdf');
    const mkdirSync = jest.fn();

    const result = await convertPdfToSvgUsingPostScript(
      {
        pdfPath: '/tmp/in.pdf',
        outputPath: '/tmp/svg/out.svg',
      },
      {
        platform: 'linux',
        existsSync,
        mkdirSync,
        runInkscape,
      },
    );

    expect(result).toEqual({
      executable: 'inkscape',
      outputPath: '/tmp/svg/out.svg',
      firstPage: 1,
      lastPage: 1,
    });

    expect(mkdirSync).toHaveBeenCalledWith('/tmp/svg', { recursive: true });
    expect(runInkscape).toHaveBeenCalledWith(
      'inkscape',
      expect.arrayContaining(['--pdf-poppler', '--pages=1', '/tmp/in.pdf']),
      'inkscape PDF->SVG',
    );
  });

  it('tries multiple executables on windows until one succeeds', async () => {
    const runInkscape: jest.MockedFunction<InkscapeRunner> = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce(undefined);

    const result = await convertPdfToSvgUsingPostScript(
      {
        pdfPath: 'C:/input/file.pdf',
        outputPath: 'C:/out/file.svg',
        executableCandidates: ['inkscape.exe', 'inkscape'],
      },
      {
        platform: 'win32',
        existsSync: () => true,
        mkdirSync: jest.fn(),
        runInkscape,
      },
    );

    expect(result.executable).toBe('inkscape');
    expect(runInkscape).toHaveBeenCalledTimes(2);
  });

  it('throws when firstPage and lastPage are different', async () => {
    await expect(
      convertPdfToSvgUsingPostScript(
        {
          pdfPath: '/tmp/in.pdf',
          outputPath: '/tmp/out.svg',
          firstPage: 1,
          lastPage: 3,
        },
        {
          platform: 'linux',
          existsSync: () => true,
          runInkscape: jest.fn(),
        },
      ),
    ).rejects.toThrow('firstPage e lastPage devono essere uguali');
  });

  it('throws when input PDF does not exist', async () => {
    await expect(
      convertPdfToSvgUsingPostScript(
        {
          pdfPath: '/tmp/missing.pdf',
          outputPath: '/tmp/out.svg',
        },
        {
          platform: 'linux',
          existsSync: () => false,
          runInkscape: jest.fn(),
        },
      ),
    ).rejects.toThrow('File PDF non trovato');
  });
});
