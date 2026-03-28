/**
 * Example Downloader - Fetch and download examples from GitHub.
 *
 * Fetches the list of available examples and downloads selected
 * examples to the local filesystem.
 */

import * as fs from 'fs';
import * as path from 'path';

import { VERSION } from '../../../constants';
import { fetchWithProxy } from '../../../util/fetch';

const GITHUB_API_BASE = 'https://api.github.com/repos/promptfoo/promptfoo';
/** Refs to try, in order: current version tag first, then main as fallback */
const DEFAULT_REFS = [VERSION, 'main'];

const EXAMPLE_CONFIG_FILENAMES = new Set([
  'promptfooconfig.yaml',
  'promptfooconfig.yml',
  'promptfooconfig.js',
  'promptfooconfig.cjs',
  'promptfooconfig.mjs',
  'promptfooconfig.ts',
]);

export interface DownloadProgress {
  /** Current file being downloaded */
  currentFile: string;
  /** Number of files downloaded */
  filesDownloaded: number;
  /** Total files to download */
  totalFiles: number;
  /** Progress percentage (0-100) */
  percentage: number;
}

export interface DownloadResult {
  success: boolean;
  filesDownloaded: string[];
  errors: Array<{ file: string; error: string }>;
}

function normalizeRepoRelativePath(candidate: string, description: string): string {
  const normalized = path.posix.normalize(candidate.replace(/\\/g, '/'));
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid ${description}: ${candidate}`);
  }
  return normalized;
}

function getSafeExampleRelativePath(exampleName: string, remotePath: string): string | null {
  const safeExampleName = normalizeRepoRelativePath(exampleName, 'example name');
  const prefix = `examples/${safeExampleName}/`;
  if (!remotePath.startsWith(prefix)) {
    return null;
  }

  try {
    return normalizeRepoRelativePath(remotePath.slice(prefix.length), 'example file path');
  } catch {
    return null;
  }
}

/**
 * Resolve the target directory for an example download.
 * Defaults to creating a dedicated ./<example> directory instead of writing into cwd.
 */
export function resolveExampleTargetDirectory(
  outputDirectory: string | undefined,
  exampleName: string,
): string {
  const safeExampleName = normalizeRepoRelativePath(exampleName, 'example name');
  if (!outputDirectory || outputDirectory === '.') {
    return path.resolve(process.cwd(), safeExampleName);
  }

  return path.resolve(process.cwd(), outputDirectory);
}

/**
 * Resolve the best available ref by trying each in order.
 */
interface TreeEntry {
  path: string;
  type: string;
}

/** Cached tree data to avoid redundant GitHub API calls within one session. */
let cachedTree: { ref: string; tree: TreeEntry[] } | null = null;

/** Reset the cached tree (for testing). */
export function resetTreeCache(): void {
  cachedTree = null;
}

/**
 * Fetch the repository tree, trying version-pinned ref first then main.
 * Caches the result so subsequent calls (fetchExampleList, getExampleFiles,
 * downloadExample) reuse the same response instead of making 3+ identical requests.
 */
async function getTree(): Promise<{ ref: string; tree: TreeEntry[] }> {
  if (cachedTree) {
    return cachedTree;
  }

  for (const ref of DEFAULT_REFS) {
    const response = await fetchWithProxy(`${GITHUB_API_BASE}/git/trees/${ref}?recursive=1`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'promptfoo-cli',
      },
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as { tree?: TreeEntry[] };
    cachedTree = { ref, tree: data.tree ?? [] };
    return cachedTree;
  }

  throw new Error('Failed to fetch repository tree from GitHub');
}

/**
 * Fetch the list of available examples from GitHub.
 *
 * Uses the Git tree API (same as init.ts) to only list runnable examples
 * — those that contain a promptfooconfig.* file.
 */
export async function fetchExampleList(): Promise<string[]> {
  const { tree } = await getTree();

  // Extract only examples that have a promptfooconfig.* at their root
  const examples = new Set<string>();
  for (const item of tree) {
    if (item.type !== 'blob' || !item.path.startsWith('examples/')) {
      continue;
    }
    const basename = path.posix.basename(item.path);
    if (!EXAMPLE_CONFIG_FILENAMES.has(basename)) {
      continue;
    }
    const exampleDir = path.posix.dirname(item.path).replace(/^examples\//, '');
    if (!exampleDir || exampleDir === '.') {
      continue;
    }
    try {
      examples.add(normalizeRepoRelativePath(exampleDir, 'example name'));
    } catch {
      continue;
    }
  }

  return [...examples].sort((a, b) => a.localeCompare(b));
}

/**
 * Get the list of files in an example directory from the cached tree.
 */
function getExampleFilesFromTree(exampleName: string, tree: TreeEntry[]): string[] {
  const safeExampleName = normalizeRepoRelativePath(exampleName, 'example name');
  const prefix = `examples/${safeExampleName}/`;
  return tree
    .filter((item) => item.type === 'blob' && item.path.startsWith(prefix))
    .map((item) => item.path);
}

/**
 * Download a single file from GitHub at the specified ref.
 */
async function downloadFile(remotePath: string, localPath: string, ref: string): Promise<void> {
  const rawBase = `https://raw.githubusercontent.com/promptfoo/promptfoo/${ref}`;
  const response = await fetchWithProxy(`${rawBase}/${remotePath}`, {
    headers: {
      'User-Agent': 'promptfoo-cli',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${remotePath}: ${response.statusText}`);
  }

  const content = await response.text();

  // Ensure directory exists
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(localPath, content, 'utf-8');
}

/**
 * Download an example to a local directory.
 */
export async function downloadExample(
  exampleName: string,
  targetDirectory: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<DownloadResult> {
  const result: DownloadResult = {
    success: true,
    filesDownloaded: [],
    errors: [],
  };

  // Use cached tree (fetched once, reused across fetchExampleList + downloadExample)
  const { ref, tree } = await getTree();
  const safeExampleName = normalizeRepoRelativePath(exampleName, 'example name');

  // Get list of files in the example from the cached tree
  const files = getExampleFilesFromTree(safeExampleName, tree);

  if (files.length === 0) {
    result.success = false;
    result.errors.push({ file: exampleName, error: 'No files found in example' });
    return result;
  }

  // Ensure target directory exists
  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  // Download each file
  for (let i = 0; i < files.length; i++) {
    const remotePath = files[i];
    const relativePath = getSafeExampleRelativePath(safeExampleName, remotePath);
    if (!relativePath) {
      result.success = false;
      result.errors.push({ file: remotePath, error: 'Invalid example file path' });
      continue;
    }
    const localPath = path.join(targetDirectory, relativePath);

    onProgress?.({
      currentFile: relativePath,
      filesDownloaded: i,
      totalFiles: files.length,
      percentage: Math.round((i / files.length) * 100),
    });

    try {
      await downloadFile(remotePath, localPath, ref);
      result.filesDownloaded.push(relativePath);
    } catch (error) {
      result.success = false;
      result.errors.push({
        file: relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Final progress update
  onProgress?.({
    currentFile: '',
    filesDownloaded: files.length,
    totalFiles: files.length,
    percentage: 100,
  });

  return result;
}

/**
 * Get a description for an example based on common patterns.
 */
export function getExampleDescription(name: string): string {
  const descriptions: Record<string, string> = {
    // Provider examples
    'openai-chat': 'Basic OpenAI chat completion',
    'openai-function-calling': 'OpenAI function/tool calling',
    'openai-assistants': 'OpenAI Assistants API',
    anthropic: 'Anthropic Claude',
    'azure-openai': 'Azure OpenAI Service',
    'google-vertex': 'Google Vertex AI',
    'amazon-bedrock': 'Amazon Bedrock',
    ollama: 'Ollama local models',

    // RAG examples
    'rag-basic': 'Simple RAG evaluation',
    'rag-advanced': 'Advanced RAG with multiple retrievers',
    'rag-context-relevance': 'RAG context relevance testing',

    // Agent examples
    'agent-tool-use': 'Agent with tool use evaluation',
    langchain: 'LangChain integration',
    llamaindex: 'LlamaIndex integration',
    autogen: 'AutoGen multi-agent',

    // Red team examples
    'redteam-basic': 'Basic security testing',
    'redteam-advanced': 'Advanced adversarial testing',

    // Other
    'custom-provider': 'Custom provider implementation',
    'python-provider': 'Python-based provider',
    'http-provider': 'HTTP API provider',
  };

  // Check for exact match first
  if (descriptions[name]) {
    return descriptions[name];
  }

  // Check for partial matches
  for (const [key, desc] of Object.entries(descriptions)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return desc;
    }
  }

  // Fallback based on patterns
  if (name.includes('redteam') || name.includes('red-team')) {
    return 'Security/red team testing';
  }
  if (name.includes('rag')) {
    return 'RAG evaluation example';
  }
  if (name.includes('agent')) {
    return 'Agent evaluation example';
  }
  if (name.includes('tool')) {
    return 'Tool use evaluation';
  }

  return 'Promptfoo configuration example';
}
