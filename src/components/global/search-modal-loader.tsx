import { createRoot, type Root } from 'react-dom/client';
import ErrorBoundary from '../ui/ErrorBoundary';
import SearchModal from './SearchModal';

let root: Root | null = null;
let mountedContainer: Element | null = null;
let openSearchController: (() => void) | null = null;
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;

function createReadyPromise() {
  readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
}

createReadyPromise();

export function registerSearchOpenController(controller: () => void) {
  openSearchController = controller;
  resolveReady?.();
  resolveReady = null;
}

export function unregisterSearchOpenController(controller: () => void) {
  if (openSearchController !== controller) return;

  openSearchController = null;
  createReadyPromise();
}

export async function mountSearchModal(container?: Element | null) {
  const nextContainer = container ?? document.getElementById('search-modal-root');
  if (!nextContainer) return;

  if (root && mountedContainer === nextContainer) {
    await readyPromise;
    return;
  }

  if (root && mountedContainer && mountedContainer !== nextContainer) {
    root.unmount();
    root = null;
    openSearchController = null;
    createReadyPromise();
  }

  root = createRoot(nextContainer);
  mountedContainer = nextContainer;
  root.render(
    <ErrorBoundary>
      <SearchModal />
    </ErrorBoundary>
  );

  await readyPromise;
}

export async function openSearchModal(container?: Element | null) {
  await mountSearchModal(container);
  openSearchController?.();
}
