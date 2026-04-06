import { useState, useEffect, useRef, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Fuse from 'fuse.js';
import type { IFuseOptions, FuseResult } from 'fuse.js';
import type { SearchItem } from '../../lib/types';
import {
  registerSearchOpenController,
  unregisterSearchOpenController,
} from './search-modal-loader';

const fuseOptions: IFuseOptions<SearchItem> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'category', weight: 0.15 },
    { name: 'tags', weight: 0.25 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
};

const typeIcons: Record<string, string> = {
  prompt: 'M8 6h13M8 12h9M8 18h11',
  blog: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  guide: 'M12 6.253v13m0-13C10.832 5.484 9.246 5 7.5 5 4.462 5 2 6.462 2 9.5v8.25A.75.75 0 002.75 18.5h5.5c1.746 0 3.332.484 4.5 1.253m0-13C13.918 5.484 15.504 5 17.25 5 20.288 5 22.75 6.462 22.75 9.5v8.25a.75.75 0 01-.75.75h-5.5c-1.746 0-3.332.484-4.5 1.253',
};

const typeLabels: Record<string, string> = {
  prompt: 'Prompt',
  blog: 'Article',
  guide: 'Guide',
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function SearchModal() {
  const [items, setItems] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<FuseResult<SearchItem>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<Fuse<SearchItem> | null>(null);
  const hasLoadedRef = useRef(false);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const openModal = useCallback(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const loadSearchIndex = useCallback(async () => {
    if (hasLoadedRef.current || isLoading) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch('/search-index.json', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load search index (${response.status})`);
      }

      const data = await response.json();
      const nextItems: SearchItem[] = Array.isArray(data) ? data : [];

      setItems(nextItems);
      hasLoadedRef.current = true;
    } catch {
      setLoadError('Search index failed to load.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    fuseRef.current = new Fuse(items, fuseOptions);
  }, [items]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();
    if (!fuseRef.current || normalizedQuery.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const searchResults = fuseRef.current.search(normalizedQuery).slice(0, 8);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    registerSearchOpenController(openModal);
    return () => unregisterSearchOpenController(openModal);
  }, [openModal]);

  useEffect(() => {
    if (isOpen) {
      void loadSearchIndex();
      window.setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }

    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    previouslyFocusedRef.current?.focus();
  }, [isOpen, loadSearchIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab') return;
      if (!modalRef.current) return;

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => {
        if (element.hasAttribute('disabled')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return element.offsetParent !== null;
      });

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen, closeModal]);

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter' && results[selectedIndex]) {
        window.location.href = results[selectedIndex].item.url;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    },
    [results, selectedIndex, closeModal]
  );

  const motionDisabled = !!prefersReducedMotion;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={motionDisabled ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Search AI prompts"
          aria-busy={isLoading}
          onClick={closeModal}
        >
          <motion.div
            initial={motionDisabled ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            ref={modalRef}
            initial={motionDisabled ? false : { opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative mx-4 w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--color-surface-1)',
              borderColor: 'var(--color-border)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 border-b px-5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <svg
                className="h-5 w-5 shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search prompts, guides, articles..."
                className="w-full bg-transparent py-4 text-base outline-none"
                style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
                aria-label="Search AI prompts"
              />
              <kbd
                className="hidden items-center rounded px-2 py-1 text-xs sm:inline-flex"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                }}
              >
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading && (
                <div className="px-5 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm">Loading search index...</p>
                </div>
              )}

              {!isLoading && loadError && (
                <div className="px-5 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm">{loadError}</p>
                </div>
              )}

              {!isLoading && !loadError && query.trim().length >= 2 && results.length === 0 && (
                <div className="px-5 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm">No results for &quot;{query}&quot;</p>
                  <p className="mt-1 text-xs">Try a different search term</p>
                </div>
              )}

              {!isLoading && !loadError && query.trim().length < 2 && (
                <div className="px-5 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="text-sm">Type at least 2 characters to search.</p>
                </div>
              )}

              {!isLoading &&
                !loadError &&
                results.map((result, index) => (
                  <motion.a
                    key={result.item.url}
                    initial={motionDisabled ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: motionDisabled ? 0 : index * 0.03 }}
                    href={result.item.url}
                    className="flex items-center gap-3 px-5 py-3 transition-colors"
                    style={{
                      backgroundColor: index === selectedIndex ? 'var(--color-surface-2)' : 'transparent',
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path d={typeIcons[result.item.type] || typeIcons.prompt} />
                    </svg>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate text-sm font-medium"
                          style={{
                            color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {result.item.name}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: 'var(--color-surface-3)',
                            color: 'var(--color-text-muted)',
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {typeLabels[result.item.type] || result.item.type}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {result.item.description}
                      </p>
                    </div>
                    <svg
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.a>
                ))}
            </div>

            <div
              className="flex items-center justify-between border-t px-5 py-3 text-xs"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd
                    className="rounded px-1.5 py-0.5"
                    style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                  >
                    &uarr;&darr;
                  </kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd
                    className="rounded px-1.5 py-0.5"
                    style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                  >
                    &crarr;
                  </kbd>
                  select
                </span>
              </div>
              <span>Powered by Fuse.js</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
