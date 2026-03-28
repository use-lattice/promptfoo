import * as fs from 'fs';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadExample,
  fetchExampleList,
  getExampleDescription,
  resetTreeCache,
  resolveExampleTargetDirectory,
} from '../../../../src/ui/init/utils/exampleDownloader';
import { fetchWithProxy } from '../../../../src/util/fetch';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('../../../../src/util/fetch', () => ({
  fetchWithProxy: vi.fn(),
}));

vi.mock('../../../../src/constants', () => ({
  VERSION: '0.100.0',
}));

/** Helper: create a mock Git tree response */
function mockTreeResponse(files: Array<{ path: string; type: string }>) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ tree: files }),
  } as unknown as Response;
}

describe('fetchExampleList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetTreeCache();
  });

  it('should fetch and return list of runnable example directories', async () => {
    // Tree API returns files — only examples with promptfooconfig.* should be listed
    vi.mocked(fetchWithProxy).mockResolvedValue(
      mockTreeResponse([
        { path: 'examples/openai-chat/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/openai-chat/README.md', type: 'blob' },
        { path: 'examples/anthropic/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/non-runnable/README.md', type: 'blob' },
      ]),
    );

    const result = await fetchExampleList();

    expect(result).toEqual(['anthropic', 'openai-chat']);
    expect(fetchWithProxy).toHaveBeenCalledWith(
      expect.stringContaining('/git/trees/0.100.0'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github.v3+json',
        }),
      }),
    );
  });

  it('should throw error when all refs fail', async () => {
    vi.mocked(fetchWithProxy).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as unknown as Response);

    await expect(fetchExampleList()).rejects.toThrow('Failed to fetch repository tree');
  });

  it('should fall back to main when version ref fails', async () => {
    vi.mocked(fetchWithProxy)
      .mockResolvedValueOnce({ ok: false, statusText: 'Not Found' } as unknown as Response)
      .mockResolvedValueOnce(
        mockTreeResponse([{ path: 'examples/example1/promptfooconfig.yaml', type: 'blob' }]),
      );

    const result = await fetchExampleList();

    expect(result).toEqual(['example1']);
    // Second call should be to main
    expect(fetchWithProxy).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetchWithProxy).mock.calls[1][0])).toContain('/git/trees/main');
  });

  it('should filter out non-blob items and files without promptfooconfig', async () => {
    vi.mocked(fetchWithProxy).mockResolvedValue(
      mockTreeResponse([
        { path: 'examples/example1/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/example1/utils.ts', type: 'blob' },
        { path: 'examples/example2', type: 'tree' }, // directory, not blob
        { path: 'examples/no-config/README.md', type: 'blob' },
        { path: 'src/index.ts', type: 'blob' }, // not in examples/
      ]),
    );

    const result = await fetchExampleList();

    expect(result).toEqual(['example1']);
  });

  it('should return sorted list', async () => {
    vi.mocked(fetchWithProxy).mockResolvedValue(
      mockTreeResponse([
        { path: 'examples/zebra/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/alpha/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/beta/promptfooconfig.yaml', type: 'blob' },
      ]),
    );

    const result = await fetchExampleList();

    expect(result).toEqual(['alpha', 'beta', 'zebra']);
  });

  it('filters out unsafe example directory names from the fetched tree', async () => {
    vi.mocked(fetchWithProxy).mockResolvedValue(
      mockTreeResponse([
        { path: 'examples/valid-example/promptfooconfig.yaml', type: 'blob' },
        { path: 'examples/../escaped/promptfooconfig.yaml', type: 'blob' },
      ]),
    );

    const result = await fetchExampleList();

    expect(result).toEqual(['valid-example']);
  });
});

describe('downloadExample', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetTreeCache();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  it('should download all files in an example', async () => {
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      // resolveRef call + getExampleFiles call (both hit tree API)
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([
          { path: 'examples/test-example/config.yaml', type: 'blob' },
          { path: 'examples/test-example/README.md', type: 'blob' },
        ]);
      }
      // Raw file download
      return {
        ok: true,
        text: vi.fn().mockResolvedValue('file content'),
      } as unknown as Response;
    });

    const result = await downloadExample('test-example', '/output');

    expect(result.success).toBe(true);
    expect(result.filesDownloaded).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should call progress callback', async () => {
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([
          { path: 'examples/test/file1.yaml', type: 'blob' },
          { path: 'examples/test/file2.yaml', type: 'blob' },
        ]);
      }
      return {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      } as unknown as Response;
    });

    const onProgress = vi.fn();
    await downloadExample('test', '/output', onProgress);

    expect(onProgress).toHaveBeenCalled();
    // Should have progress updates plus final update
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Last call should be 100%
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.percentage).toBe(100);
  });

  it('should handle download errors gracefully', async () => {
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([{ path: 'examples/test/file.yaml', type: 'blob' }]);
      }
      // Fail the file download
      return {
        ok: false,
        statusText: 'Not Found',
      } as unknown as Response;
    });

    const result = await downloadExample('test', '/output');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return error when no files found', async () => {
    vi.mocked(fetchWithProxy).mockResolvedValue(mockTreeResponse([]));

    const result = await downloadExample('empty-example', '/output');

    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual({
      file: 'empty-example',
      error: 'No files found in example',
    });
  });

  it('should create target directory if it does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([{ path: 'examples/test/file.yaml', type: 'blob' }]);
      }
      return {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      } as unknown as Response;
    });

    await downloadExample('test', '/new-directory');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/new-directory', { recursive: true });
  });

  it('should handle subdirectories in examples', async () => {
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([
          { path: 'examples/test/file.yaml', type: 'blob' },
          { path: 'examples/test/subdir/nested.yaml', type: 'blob' },
        ]);
      }
      return {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      } as unknown as Response;
    });

    const result = await downloadExample('test', '/output');

    expect(result.success).toBe(true);
    expect(result.filesDownloaded).toContain('file.yaml');
    expect(result.filesDownloaded).toContain('subdir/nested.yaml');
  });

  it('should reject unsafe file paths from the repository tree', async () => {
    vi.mocked(fetchWithProxy).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return mockTreeResponse([{ path: 'examples/test/../../escape.yaml', type: 'blob' }]);
      }
      return {
        ok: true,
        text: vi.fn().mockResolvedValue('content'),
      } as unknown as Response;
    });

    const result = await downloadExample('test', '/output');

    expect(result.success).toBe(false);
    expect(result.errors).toContainEqual({
      file: 'examples/test/../../escape.yaml',
      error: 'Invalid example file path',
    });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('resolveExampleTargetDirectory', () => {
  it('creates a dedicated directory when no output directory is provided', () => {
    expect(resolveExampleTargetDirectory(undefined, 'openai-chat')).toBe(
      path.resolve(process.cwd(), 'openai-chat'),
    );
  });

  it('creates a dedicated directory when the output directory is .', () => {
    expect(resolveExampleTargetDirectory('.', 'openai-chat')).toBe(
      path.resolve(process.cwd(), 'openai-chat'),
    );
  });

  it('respects an explicit output directory', () => {
    expect(resolveExampleTargetDirectory('./custom-dir', 'openai-chat')).toBe(
      path.resolve(process.cwd(), './custom-dir'),
    );
  });

  it('rejects unsafe example names', () => {
    expect(() => resolveExampleTargetDirectory(undefined, '../escape')).toThrow(
      'Invalid example name',
    );
  });
});

describe('getExampleDescription', () => {
  it('should return exact match description', () => {
    expect(getExampleDescription('openai-chat')).toBe('Basic OpenAI chat completion');
    expect(getExampleDescription('anthropic')).toBe('Anthropic Claude');
  });

  it('should return partial match description', () => {
    expect(getExampleDescription('my-openai-chat-example')).toBe('Basic OpenAI chat completion');
    expect(getExampleDescription('openai-function-calling-advanced')).toBe(
      'OpenAI function/tool calling',
    );
  });

  it('should return pattern-based description for redteam', () => {
    expect(getExampleDescription('my-redteam-test')).toBe('Security/red team testing');
    expect(getExampleDescription('some-red-team-example')).toBe('Security/red team testing');
  });

  it('should return pattern-based description for rag', () => {
    expect(getExampleDescription('custom-rag-example')).toBe('RAG evaluation example');
  });

  it('should return pattern-based description for agent', () => {
    expect(getExampleDescription('my-agent-example')).toBe('Agent evaluation example');
  });

  it('should return pattern-based description for tool', () => {
    expect(getExampleDescription('custom-tool-example')).toBe('Tool use evaluation');
  });

  it('should return fallback description for unknown examples', () => {
    expect(getExampleDescription('completely-unknown-example')).toBe(
      'Promptfoo configuration example',
    );
  });

  it('should handle common provider examples', () => {
    expect(getExampleDescription('azure-openai')).toBe('Azure OpenAI Service');
    expect(getExampleDescription('google-vertex')).toBe('Google Vertex AI');
    expect(getExampleDescription('amazon-bedrock')).toBe('Amazon Bedrock');
    expect(getExampleDescription('ollama')).toBe('Ollama local models');
  });

  it('should handle framework examples', () => {
    expect(getExampleDescription('langchain')).toBe('LangChain integration');
    expect(getExampleDescription('llamaindex')).toBe('LlamaIndex integration');
    expect(getExampleDescription('autogen')).toBe('AutoGen multi-agent');
  });
});
